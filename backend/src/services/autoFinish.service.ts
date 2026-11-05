import type { PrismaClient } from "../generated/prisma/client";

import { DOUBLE_FORFEIT } from "../contracts/catalogs";
import { emitToTournament } from "../sockets/broadcast";
import { SOCKET_EVENTS } from "../sockets/events";
import { plain, recordAuditLog } from "./auditLog.service";
import { completeBlockedSuppressions } from "./dataRights.service";
import { recalculateStandings } from "./standings.service";
import { lockTournament } from "./tournamentAccess";

// A tournament in play past its end date closes on its own, with whatever
// was played (docs/decisions/010-cierre-automatico-por-fecha.md): a game
// still without a result becomes FIDE's double forfeit (0F-0F), a draft
// round that was never published is discarded, and the standings are
// final. A tournament that never started (no round published, so never
// IN_PROGRESS) is left alone.

const DAY_MS = 24 * 60 * 60 * 1000;
// Colombia is UTC-5 all year (no daylight saving).
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * The moment a tournament ending on `endDate` is over: the end of that day
 * in Bogotá. A tournament date is a calendar day, stored at UTC midnight.
 */
export function closesAt(endDate: Date): Date {
  return new Date(endDate.getTime() + DAY_MS + BOGOTA_OFFSET_MS);
}

/** Today's calendar day in Bogotá, stored like a tournament date: at UTC midnight. */
export function todayInBogota(now = new Date()): Date {
  const local = now.getTime() - BOGOTA_OFFSET_MS;
  return new Date(local - (local % DAY_MS));
}

export interface AutoFinishOutcome {
  finished: string[];
  failed: { tournamentId: string; error: unknown }[];
}

/**
 * Closes every tournament in play whose end date is over, one transaction
 * each: one that fails doesn't hold back the rest, and is tried again on
 * the next pass.
 */
export async function finishOverdueTournaments(prisma: PrismaClient, now = new Date()): Promise<AutoFinishOutcome> {
  const overdue = await prisma.tournament.findMany({
    where: { status: "IN_PROGRESS", endDate: { lte: new Date(now.getTime() - DAY_MS - BOGOTA_OFFSET_MS) } },
    select: { id: true },
    orderBy: { endDate: "asc" },
  });

  const outcome: AutoFinishOutcome = { finished: [], failed: [] };
  for (const { id } of overdue) {
    try {
      if (await finishOverdueTournament(prisma, id, now)) outcome.finished.push(id);
    } catch (error) {
      outcome.failed.push({ tournamentId: id, error });
    }
  }
  return outcome;
}

/** How often a running server looks for tournaments to close. */
export const AUTO_FINISH_INTERVAL_MS = 15 * 60 * 1000;

interface AutoFinishLog {
  info(details: object, message: string): void;
  error(details: object, message: string): void;
}

/**
 * Looks for overdue tournaments now and every {@link AUTO_FINISH_INTERVAL_MS}.
 * On Render's free plan the server sleeps when idle, so the pass on startup
 * matters most: the first visit after the end date wakes it, and closes the
 * tournament. Passes never overlap.
 *
 * @returns A function that stops it.
 */
export function scheduleAutoFinish(
  prisma: PrismaClient,
  log: AutoFinishLog,
  intervalMs = AUTO_FINISH_INTERVAL_MS,
): () => void {
  let running = false;
  const pass = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const { finished, failed } = await finishOverdueTournaments(prisma);
      if (finished.length > 0) log.info({ tournaments: finished }, "tournaments past their end date closed");
      for (const { tournamentId, error } of failed) {
        log.error({ err: error, tournamentId }, "could not close a tournament past its end date");
      }
    } catch (error) {
      log.error({ err: error }, "could not look for tournaments past their end date");
    } finally {
      running = false;
    }
  };

  void pass();
  const timer = setInterval(() => void pass(), intervalMs);
  // A pending pass never keeps the process alive on its own.
  timer.unref();
  return () => clearInterval(timer);
}

/** Closes one overdue tournament; false if, under the lock, it no longer needs it. */
async function finishOverdueTournament(prisma: PrismaClient, tournamentId: string, now: Date): Promise<boolean> {
  const finished = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    // Checked again under the lock: it may have been closed by hand, or had
    // its end date moved, since it was listed.
    if (tournament.status !== "IN_PROGRESS" || closesAt(tournament.endDate) > now) return false;

    // RN-04: a draft never became official. Discarded as discardRound does.
    const drafts = (
      await tx.round.findMany({ where: { tournamentId, status: "GENERATED" }, select: { id: true } })
    ).map((round) => round.id);
    if (drafts.length > 0) {
      await tx.result.deleteMany({ where: { match: { roundId: { in: drafts } } } });
      await tx.match.deleteMany({ where: { roundId: { in: drafts } } });
      await tx.round.deleteMany({ where: { id: { in: drafts } } });
    }

    // The games nobody recorded: neither player gets the point.
    const unplayed = (
      await tx.match.findMany({ where: { round: { tournamentId }, result: { is: null } }, select: { id: true } })
    ).map((match) => match.id);
    if (unplayed.length > 0) {
      await tx.result.createMany({ data: unplayed.map((matchId) => ({ matchId, value: DOUBLE_FORFEIT })) });
      await tx.match.updateMany({ where: { id: { in: unplayed } }, data: { status: "FINISHED" } });
    }

    await tx.round.updateMany({ where: { tournamentId }, data: { status: "STANDINGS_UPDATED" } });
    await recalculateStandings(tx, tournamentId);
    await tx.tournament.update({ where: { id: tournamentId }, data: { status: "FINISHED" } });
    await recordAuditLog(
      tx,
      null,
      "TOURNAMENT_AUTO_FINISHED",
      `"${plain(tournament.name)}" · ${DOUBLE_FORFEIT}: ${unplayed.length} · rondas borrador descartadas: ${drafts.length}`,
    );
    // HU22: whoever asked to be erased while this tournament ran can be now.
    await completeBlockedSuppressions(tx, tournamentId);
    return true;
  });

  // After the commit (docs/decisions/003-los-eventos-solo-avisan.md).
  if (finished) emitToTournament(tournamentId, SOCKET_EVENTS.TOURNAMENT_FINISHED, { tournamentId });
  return finished;
}
