import type { Prisma, PrismaClient, Round, Tournament } from "../generated/prisma/client";

import { HttpError, type ApiErrorCode } from "../errors/apiErrors";
import { emitToTournament, emitToTournamentManagers } from "../sockets/broadcast";
import { SOCKET_EVENTS } from "../sockets/events";
import type { AuthUser } from "../types/express";
import type { SwapPlayersSchemaInput } from "../validators/rounds.schemas";
import { mention, recordAuditLog } from "./auditLog.service";
import { candidatesFromHistory, drawPairingNumbers, type PlayedGame } from "./pairing/pairingHistory";
import { pairRound, PairingImpossibleError } from "./pairing/swissPairing";
import { ROUND_INCLUDE, toRoundDto, type RoundDto, type RoundWithMatches } from "./round.mapper";
import { recalculateStandings } from "./standings.service";
import {
  assertCanManageTournament,
  assertCanViewTournament,
  assertNotFinished,
  canManageTournament,
  loadTournament,
  lockTournament,
} from "./tournamentAccess";

// The round lifecycle (docs/media/image8.png), reusing RoundStatus as is:
//   GENERATED          draft: only its managers see it; can be adjusted
//                      (HU29) or discarded and regenerated.
//   RECORDING_RESULTS  published (HU09): visible to everyone, results open.
//   STANDINGS_UPDATED  every game recorded: the round is closed.

type Db = Prisma.TransactionClient;
type RoundWithTournament = Round & { tournament: Tournament };

async function findRound(db: Db, roundId: string): Promise<Round> {
  const round = await db.round.findUnique({ where: { id: roundId } });
  if (!round) {
    throw new HttpError("ROUND_NOT_FOUND");
  }
  return round;
}

/**
 * Locks the round's tournament (see lockTournament) and loads both as they
 * are now: a round published or discarded by someone else a moment ago is
 * seen as such.
 *
 * @throws {HttpError} 404 if the round doesn't exist (anymore).
 */
async function lockRound(tx: Db, roundId: string): Promise<RoundWithTournament> {
  const { tournamentId } = await findRound(tx, roundId);
  const tournament = await lockTournament(tx, tournamentId);
  return { ...(await findRound(tx, roundId)), tournament };
}

/** Games already played in the tournament, as the pairing engine and rematch checks need them. */
async function loadPlayedGames(db: Db, tournamentId: string): Promise<PlayedGame[]> {
  const matches = await db.match.findMany({
    where: { round: { tournamentId, status: { not: "GENERATED" } }, result: { isNot: null } },
    select: { whiteId: true, blackId: true, result: { select: { value: true } }, round: { select: { number: true } } },
  });
  return matches.flatMap((match) =>
    match.result
      ? [{ whiteId: match.whiteId, blackId: match.blackId, value: match.result.value, round: match.round.number }]
      : [],
  );
}

/** Marks a round closed (STANDINGS_UPDATED) once every one of its games has a result. */
export async function closeRoundIfComplete(db: Db, roundId: string): Promise<boolean> {
  const pending = await db.match.count({ where: { roundId, result: { is: null } } });
  if (pending > 0) return false;
  await db.round.update({ where: { id: roundId }, data: { status: "STANDINGS_UPDATED" } });
  return true;
}

/** HU18: the tournament's rounds. Drafts are only listed for whoever manages the tournament. */
export async function listRounds(prisma: PrismaClient, tournamentId: string, viewer: AuthUser): Promise<RoundDto[]> {
  const tournament = await loadTournament(prisma, tournamentId);
  assertCanViewTournament(tournament, viewer);

  const rounds = await prisma.round.findMany({
    where: { tournamentId, ...(canManageTournament(tournament, viewer) ? {} : { status: { not: "GENERATED" } }) },
    include: ROUND_INCLUDE,
    orderBy: { number: "asc" },
  });
  return rounds.map(toRoundDto);
}

/** @throws {HttpError} 409 unless the latest round is closed (or there is none yet). */
function assertPreviousRoundClosed(last: Round | null): void {
  if (last?.status === "GENERATED") {
    throw new HttpError("DRAFT_PENDING", { number: last.number });
  }
  if (last?.status === "RECORDING_RESULTS") {
    throw new HttpError("RESULTS_PENDING", { number: last.number });
  }
}

/**
 * HU08/HU28: pairs the next round and stores it as a draft. Round 1 also
 * makes the random draw that fixes every player's pairing number.
 *
 * @throws {HttpError} 409 if the tournament's state doesn't allow a new round
 * or no pairing avoids a rematch.
 */
export async function generateRound(prisma: PrismaClient, tournamentId: string, actor: AuthUser): Promise<RoundDto> {
  const round = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertCanManageTournament(tournament, actor);
    assertNotFinished(tournament);
    if (tournament.status !== "REGISTRATION_CLOSED" && tournament.status !== "IN_PROGRESS") {
      throw new HttpError("REGISTRATION_STILL_OPEN");
    }
    if (!tournament.roundsCount) {
      throw new HttpError("ROUNDS_NOT_CONFIGURED");
    }

    const last = await tx.round.findFirst({ where: { tournamentId }, orderBy: { number: "desc" } });
    assertPreviousRoundClosed(last);
    const number = (last?.number ?? 0) + 1;
    if (number > tournament.roundsCount) {
      throw new HttpError("ALL_ROUNDS_PLAYED", { count: tournament.roundsCount });
    }

    // RN-07: withdrawn players never get paired again.
    const enrollments = await tx.enrollment.findMany({
      where: { tournamentId, withdrawnAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (enrollments.length < 2) {
      throw new HttpError("NOT_ENOUGH_PLAYERS");
    }

    const drawn = number === 1 ? drawPairingNumbers(enrollments.map((enrollment) => enrollment.playerId)) : null;
    const players = enrollments.map((enrollment, index) => ({
      id: enrollment.playerId,
      // Nobody can join after registration closes, so a null here can only
      // be a pre-existing gap; sorting them last keeps the draw's order.
      pairingNumber: drawn?.get(enrollment.playerId) ?? enrollment.pairingNumber ?? enrollments.length + index + 1,
    }));

    const games = await loadPlayedGames(tx, tournamentId);
    let pairing;
    try {
      pairing = pairRound(candidatesFromHistory(players, games, Number(tournament.byePoints)));
    } catch (error) {
      if (error instanceof PairingImpossibleError) {
        throw new HttpError("PAIRING_IMPOSSIBLE", { number });
      }
      throw error;
    }

    return createDraftRound(tx, tournamentId, number, drawn, pairing);
  });

  return toRoundDto(round);
}

/** Persists a freshly paired round as a draft (and, for round 1, the pairing numbers drawn). */
async function createDraftRound(
  tx: Db,
  tournamentId: string,
  number: number,
  drawn: Map<string, number> | null,
  pairing: ReturnType<typeof pairRound>,
): Promise<RoundWithMatches> {
  if (drawn) {
    for (const [playerId, pairingNumber] of drawn) {
      await tx.enrollment.update({
        where: { tournamentId_playerId: { tournamentId, playerId } },
        data: { pairingNumber },
      });
    }
  }

  const boards = pairing.pairings.map((pair, index) => ({ board: index + 1, ...pair }));
  return tx.round.create({
    data: {
      tournamentId,
      number,
      matches: {
        create: [
          ...boards,
          // HU28: the bye is a match without an opponent, already scored.
          // It only counts once the round is published (RN-04).
          ...(pairing.byeId
            ? [
                {
                  board: boards.length + 1,
                  whiteId: pairing.byeId,
                  status: "FINISHED" as const,
                  result: { create: { value: "BYE" } },
                },
              ]
            : []),
        ],
      },
    },
    include: ROUND_INCLUDE,
  });
}

/** @throws {HttpError} `refused` (409) unless the round is still a draft. */
function assertDraft(round: Round, refused: ApiErrorCode): void {
  if (round.status !== "GENERATED") {
    throw new HttpError(refused);
  }
}

/** Deletes a draft round so it can be paired again (e.g. to redo the round-1 draw). */
export async function discardRound(prisma: PrismaClient, roundId: string, actor: AuthUser): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await lockRound(tx, roundId);
    assertCanManageTournament(round.tournament, actor);
    assertDraft(round, "DISCARD_NEEDS_DRAFT");

    await tx.result.deleteMany({ where: { match: { roundId } } });
    await tx.match.deleteMany({ where: { roundId } });
    await tx.round.delete({ where: { id: roundId } });
  });
}

type Side = "whiteId" | "blackId";

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

interface Seat {
  matchId: string;
  side: Side;
  // The seated player's user id, to mention them in the audit trail.
  userId: string;
}

function findSeat(matches: RoundWithMatches["matches"], playerId: string): Seat {
  for (const match of matches) {
    if (match.white?.id === playerId) return { matchId: match.id, side: "whiteId", userId: match.white.userId };
    if (match.black?.id === playerId) return { matchId: match.id, side: "blackId", userId: match.black.userId };
  }
  throw new HttpError("PLAYER_NOT_IN_ROUND");
}

/**
 * HU29: swaps two players' seats in a draft round (same board = colors
 * flipped; a bye seat can be swapped too). Swapping always leaves a valid
 * round: everyone still plays exactly once. It may create a rematch, which
 * RN-02 allows only through this authorized, audited adjustment (RN-09).
 *
 * @throws {HttpError} 409 if the round is already published, 404 if a player isn't in it.
 */
export async function swapPlayers(
  prisma: PrismaClient,
  roundId: string,
  data: SwapPlayersSchemaInput,
  actor: AuthUser,
): Promise<RoundDto> {
  if (data.playerAId === data.playerBId) {
    throw new HttpError("SAME_PLAYER_TWICE");
  }

  const { round, updated } = await prisma.$transaction(async (tx) => {
    const round = await lockRound(tx, roundId);
    assertCanManageTournament(round.tournament, actor);
    assertDraft(round, "ADJUST_NEEDS_DRAFT");

    const { matches } = await tx.round.findUniqueOrThrow({ where: { id: roundId }, include: ROUND_INCLUDE });
    const seatA = findSeat(matches, data.playerAId);
    const seatB = findSeat(matches, data.playerBId);

    // Two updates on the same row would overwrite each other: build the final
    // seats per match first, then write each match once.
    const updates = new Map<string, Partial<Record<Side, string>>>();
    updates.set(seatA.matchId, { ...updates.get(seatA.matchId), [seatA.side]: data.playerBId });
    updates.set(seatB.matchId, { ...updates.get(seatB.matchId), [seatB.side]: data.playerAId });

    // Whether the new seating repeats an earlier game: allowed (RN-02 admits
    // an authorized manual adjustment) but called out in the audit trail.
    const played = await loadPlayedGames(tx, round.tournamentId);
    const met = new Set(
      played.flatMap((game) => (game.whiteId && game.blackId ? [pairKey(game.whiteId, game.blackId)] : [])),
    );
    const createsRematch = matches.some((match) => {
      const seats = updates.get(match.id);
      if (!seats) return false;
      const whiteId = seats.whiteId ?? match.whiteId;
      const blackId = seats.blackId ?? match.blackId;
      return whiteId !== null && blackId !== null && met.has(pairKey(whiteId, blackId));
    });

    for (const [matchId, seats] of updates) {
      await tx.match.update({ where: { id: matchId }, data: seats });
    }
    // RN-09/RN-11: who adjusted it (the log's user) and why, committed with the change.
    await recordAuditLog(
      tx,
      actor.id,
      "PAIRING_ADJUSTED",
      `Ronda ${round.number} de "${round.tournament.name}": ${mention(seatA.userId)} ↔ ${mention(seatB.userId)}` +
        `${createsRematch ? " (repite un enfrentamiento previo)" : ""} — ${data.reason}`,
    );
    return { round, updated: await tx.round.findUniqueOrThrow({ where: { id: roundId }, include: ROUND_INCLUDE }) };
  });

  // Still a draft: only its managers may know it exists.
  emitToTournamentManagers(round.tournamentId, SOCKET_EVENTS.PAIRING_ADJUSTED, { roundId });

  return toRoundDto(updated);
}

/**
 * RN-07: a player withdrawn after the draft was generated must not be
 * published into it; the draft has to be paired again without them.
 *
 * @throws {HttpError} 409 naming the withdrawn player.
 */
async function assertNoWithdrawnPlayerSeated(tx: Db, round: Round): Promise<void> {
  const seated = await tx.match.findMany({
    where: { roundId: round.id },
    select: { whiteId: true, blackId: true },
  });
  const playerIds = seated.flatMap((match) => [match.whiteId, match.blackId]).filter((id): id is string => id !== null);
  const withdrawn = await tx.enrollment.findFirst({
    where: { tournamentId: round.tournamentId, playerId: { in: playerIds }, withdrawnAt: { not: null } },
    include: { player: { include: { user: { select: { name: true } } } } },
  });
  if (withdrawn) {
    throw new HttpError("WITHDRAWN_PLAYER_SEATED", { name: withdrawn.player.user.name });
  }
}

/**
 * HU09: publishes a draft round: everyone can see it, results can be
 * recorded, and its bye starts counting. Publishing round 1 starts the tournament.
 *
 * @throws {HttpError} 409 if it isn't a draft or the tournament is finished.
 */
export async function publishRound(prisma: PrismaClient, roundId: string, actor: AuthUser): Promise<RoundDto> {
  const { round, published } = await prisma.$transaction(async (tx) => {
    const round = await lockRound(tx, roundId);
    assertCanManageTournament(round.tournament, actor);
    assertNotFinished(round.tournament);
    assertDraft(round, "PUBLISH_NEEDS_DRAFT");
    await assertNoWithdrawnPlayerSeated(tx, round);

    await tx.round.update({ where: { id: roundId }, data: { status: "RECORDING_RESULTS" } });
    if (round.tournament.status === "REGISTRATION_CLOSED") {
      await tx.tournament.update({ where: { id: round.tournamentId }, data: { status: "IN_PROGRESS" } });
    }
    await closeRoundIfComplete(tx, roundId);
    await recalculateStandings(tx, round.tournamentId);
    return { round, published: await tx.round.findUniqueOrThrow({ where: { id: roundId }, include: ROUND_INCLUDE }) };
  });

  emitToTournament(round.tournamentId, SOCKET_EVENTS.PAIRING_PUBLISHED, { roundId, number: round.number });
  emitToTournament(round.tournamentId, SOCKET_EVENTS.STANDINGS_UPDATED, { tournamentId: round.tournamentId });

  return toRoundDto(published);
}
