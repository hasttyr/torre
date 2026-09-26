import type { Prisma, PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import { emitToTournament } from "../sockets/broadcast";
import { SOCKET_EVENTS } from "../sockets/events";
import type { AuthUser } from "../types/express";
import type { GameResult } from "../validators/rounds.schemas";
import { recordAuditLog } from "./auditLog.service";
import { isUniqueConstraintError } from "./prismaErrors";
import { closeRoundIfComplete } from "./rounds.service";
import { recalculateStandings } from "./standings.service";
import { assertCanRecordResults, assertNotFinished } from "./tournamentAccess";

type Db = Prisma.TransactionClient;

const MATCH_INCLUDE = {
  round: { include: { tournament: true } },
  result: true,
  white: { select: { user: { select: { name: true } } } },
  black: { select: { user: { select: { name: true } } } },
} satisfies Prisma.MatchInclude;

type LoadedMatch = Prisma.MatchGetPayload<{ include: typeof MATCH_INCLUDE }>;

async function loadMatch(db: Db, matchId: string): Promise<LoadedMatch> {
  const match = await db.match.findUnique({ where: { id: matchId }, include: MATCH_INCLUDE });
  if (!match) {
    throw new HttpError(404, "Partida no encontrada");
  }
  return match;
}

/** Rules shared by recording and correcting: who (RN-06), when (HU17, HU09) and what (no bye). */
function assertResultCanChange(match: LoadedMatch, actor: AuthUser): void {
  assertCanRecordResults(match.round.tournament, actor);
  assertNotFinished(match.round.tournament);
  if (match.round.status === "GENERATED") {
    throw new HttpError(409, "La ronda todavía no fue publicada");
  }
  if (!match.whiteId || !match.blackId) {
    throw new HttpError(409, "Un bye no lleva resultado");
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
  const match = await loadMatch(prisma, matchId);
  assertResultCanChange(match, actor);
  if (match.result) {
    throw new HttpError(409, "Esta partida ya tiene resultado; para cambiarlo usá la corrección");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.result.create({ data: { matchId, value } });
      await tx.match.update({ where: { id: matchId }, data: { status: "FINISHED" } });
      await afterResultChange(tx, match);
    });
  } catch (error) {
    // Two arbiters submitting the same board at once: results.match_id is unique.
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Otro usuario acaba de registrar el resultado de esta partida");
    }
    throw error;
  }

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
  const match = await loadMatch(prisma, matchId);
  assertResultCanChange(match, actor);
  if (!match.result) {
    throw new HttpError(409, "Esta partida todavía no tiene resultado para corregir");
  }
  if (match.result.value === value) {
    throw new HttpError(409, "El resultado nuevo es igual al registrado");
  }

  const detail =
    `"${match.round.tournament.name}", ronda ${match.round.number}, mesa ${match.board} ` +
    `(${match.white?.user.name} – ${match.black?.user.name}): ${match.result.value} → ${value}` +
    (reason ? ` — ${reason}` : "");

  await prisma.$transaction(async (tx) => {
    await tx.result.update({ where: { matchId }, data: { value, recordedAt: new Date() } });
    await tx.match.update({ where: { id: matchId }, data: { status: "CORRECTED" } });
    await afterResultChange(tx, match);
    await recordAuditLog(tx, actor.id, "RESULT_CORRECTED", detail);
  });

  broadcast(match, value);
}
