import type { Prisma, PrismaClient } from "../generated/prisma/client";

import { HttpError } from "../errors/apiErrors";
import { emitToTournament } from "../sockets/broadcast";
import { SOCKET_EVENTS } from "../sockets/events";
import type { AuthUser } from "../types/express";
import type { GameResult } from "../validators/rounds.schemas";
import { mention, recordAuditLog } from "./auditLog.service";
import { closeRoundIfComplete } from "./rounds.service";
import { recalculateStandings } from "./standings.service";
import { assertCanRecordResults, assertNotFinished, lockTournament } from "./tournamentAccess";

type Db = Prisma.TransactionClient;

const MATCH_INCLUDE = {
  round: { include: { tournament: true } },
  result: true,
  white: { select: { userId: true } },
  black: { select: { userId: true } },
} satisfies Prisma.MatchInclude;

type LoadedMatch = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>;
// A game between two players, as opposed to a bye.
type PlayedMatch = LoadedMatch & { white: { userId: string }; black: { userId: string } };

async function loadMatch(db: Db, matchId: string): Promise<LoadedMatch> {
  const match = await db.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE });
  if (!match) {
    throw new HttpError("MATCH_NOT_FOUND");
  }
  return match;
}

/**
 * Locks the match's tournament (see lockTournament) and loads the match as
 * it is now: its result, its round and its tournament, fresh.
 */
async function lockMatch(tx: Db, matchId: string): Promise<LoadedMatch> {
  await lockTournament(tx, (await loadMatch(tx, matchId)).round.tournamentId);
  return loadMatch(tx, matchId);
}

/** Rules shared by recording and correcting: who (RN-06), when (HU17, HU09) and what (no bye). */
function assertResultCanChange(match: LoadedMatch, actor: AuthUser): asserts match is PlayedMatch {
  assertCanRecordResults(match.round.tournament, actor);
  assertNotFinished(match.round.tournament);
  if (match.round.status === "GENERATED") {
    throw new HttpError("ROUND_NOT_PUBLISHED");
  }
  if (!match.white || !match.black) {
    throw new HttpError("BYE_HAS_NO_RESULT");
  }
}

/** Recalculation + broadcast shared by recording and correcting a result. */
async function afterResultChange(tx: Db, match: LoadedMatch): Promise<void> {
  await closeRoundIfComplete(tx, match.roundId);
  await recalculateStandings(tx, match.round.tournamentId);
}

function broadcast(match: LoadedMatch, value: GameResult): void {
  const tournamentId = match.round.tournamentId;
  emitToTournament(tournamentId, SOCKET_EVENTS.MATCH_RESULT_RECORDED, {
    matchId: match.id,
    roundId: match.roundId,
    value,
  });
  emitToTournament(tournamentId, SOCKET_EVENTS.STANDINGS_UPDATED, { tournamentId });
}

/**
 * HU10: records a game's official result, then recalculates the standings
 * (HU12) and closes the round when it was its last pending game.
 *
 * @throws {HttpError} 403 (RN-06), 409 if the game already has a result
 * (that's a correction, HU11), isn't published yet, or the tournament finished.
 */
export async function recordResult(
  prisma: PrismaClient,
  matchId: string,
  value: GameResult,
  actor: AuthUser,
): Promise<void> {
  const match = await prisma.$transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    assertResultCanChange(match, actor);
    if (match.result) {
      throw new HttpError("RESULT_ALREADY_RECORDED");
    }

    await tx.result.create({ data: { matchId, value } });
    await tx.match.update({ where: { id: matchId }, data: { status: "FINISHED" } });
    await afterResultChange(tx, match);
    return match;
  });

  broadcast(match, value);
}

/**
 * HU11: corrects an already recorded result. The change is audited (RN-11)
 * with the previous and new value, and the standings are rebuilt.
 *
 * @throws {HttpError} 403 (RN-06), 409 if there's nothing to correct, the
 * value is unchanged, or the tournament finished.
 */
export async function correctResult(
  prisma: PrismaClient,
  matchId: string,
  value: GameResult,
  reason: string | undefined,
  actor: AuthUser,
): Promise<void> {
  const match = await prisma.$transaction(async (tx) => {
    const match = await lockMatch(tx, matchId);
    assertResultCanChange(match, actor);
    if (!match.result) {
      throw new HttpError("NO_RESULT_TO_CORRECT");
    }
    if (match.result.value === value) {
      throw new HttpError("RESULT_UNCHANGED");
    }

    await tx.result.update({ where: { matchId }, data: { value, recordedAt: new Date() } });
    await tx.match.update({ where: { id: matchId }, data: { status: "CORRECTED" } });
    await afterResultChange(tx, match);
    await recordAuditLog(
      tx,
      actor.id,
      "RESULT_CORRECTED",
      `"${match.round.tournament.name}", ronda ${match.round.number}, mesa ${match.board} ` +
        `(${mention(match.white.userId)} – ${mention(match.black.userId)}): ${match.result.value} → ${value}` +
        (reason ? ` — ${reason}` : ""),
    );
    return match;
  });

  broadcast(match, value);
}
