import type { Prisma, PrismaClient } from "@prisma/client";

import type { AuthUser } from "../types/express";
import { computeStandings, rankStandings, type RecordedGame } from "./standings.calculator";
import { assertCanViewTournament, loadTournament } from "./tournamentAccess";

type Db = Prisma.TransactionClient;

/**
 * RN-04: only officially recorded games count, i.e. results in rounds that
 * have been published. A draft round's bye (created with the draft) stays
 * out until the round is published.
 */
async function loadOfficialGames(db: Db, tournamentId: string): Promise<RecordedGame[]> {
  const results = await db.result.findMany({
    where: { match: { round: { tournamentId, status: { not: "GENERATED" } } } },
    select: { value: true, match: { select: { whiteId: true, blackId: true } } },
  });
  return results.map((result) => ({ ...result.match, value: result.value }));
}

/**
 * HU12/HU13: recomputes the tournament's standings from its official games
 * and persists them, ranked with the tournament's tiebreak order. Always a
 * full rebuild (never an incremental patch), so a corrected result (HU11)
 * can't leave stale numbers behind. Call it inside the same transaction as
 * the change that triggered it.
 */
export async function recalculateStandings(db: Db, tournamentId: string): Promise<void> {
  const tournament = await db.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: { tiebreakCriteria: { orderBy: { order: "asc" } } },
  });
  const [games, active] = await Promise.all([
    loadOfficialGames(db, tournamentId),
    db.enrollment.findMany({ where: { tournamentId, withdrawnAt: null }, select: { playerId: true } }),
  ]);
  const computed = computeStandings(games, Number(tournament.byePoints));
  // Every active player is on the table from round 1, at 0 until their
  // first recorded game; a withdrawn player stays only if they played.
  const listed = new Set(computed.map((row) => row.playerId));
  const unplayed = active
    .filter(({ playerId }) => !listed.has(playerId))
    .map(({ playerId }) => ({ playerId, score: 0, buchholz: 0, buchholzCut1: 0, sonnebornBerger: 0 }));

  const ranked = rankStandings(
    [...computed, ...unplayed],
    tournament.tiebreakCriteria.map((criterion) => criterion.name),
    games,
  );

  await db.standing.deleteMany({ where: { tournamentId } });
  await db.standing.createMany({
    data: ranked.map((row, index) => ({ tournamentId, ...row, rank: index + 1 })),
  });
}

export interface StandingRowDto {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  buchholz: number;
  buchholzCut1: number;
  sonnebornBerger: number;
  withdrawn: boolean;
}

export interface StandingsDto {
  tournamentId: string;
  // HU12: true while the latest published round still has games without a
  // result — the table is provisional until they're all in.
  pending: boolean;
  roundsCompleted: number;
  tiebreaks: string[];
  rows: StandingRowDto[];
}

/** HU14/HU18: the tournament's current official standings. */
export async function getStandings(
  prisma: PrismaClient,
  tournamentId: string,
  viewer: AuthUser,
): Promise<StandingsDto> {
  const tournament = await loadTournament(prisma, tournamentId);
  assertCanViewTournament(tournament, viewer);

  const [standings, rounds, withdrawn, criteria] = await Promise.all([
    prisma.standing.findMany({
      where: { tournamentId },
      include: { player: { select: { user: { select: { name: true } } } } },
      orderBy: { rank: "asc" },
    }),
    prisma.round.findMany({ where: { tournamentId }, select: { status: true } }),
    prisma.enrollment.findMany({
      where: { tournamentId, withdrawnAt: { not: null } },
      select: { playerId: true },
    }),
    prisma.tiebreakCriterion.findMany({ where: { tournamentId }, orderBy: { order: "asc" } }),
  ]);
  const withdrawnIds = new Set(withdrawn.map((enrollment) => enrollment.playerId));

  return {
    tournamentId,
    pending: rounds.some((round) => round.status === "RECORDING_RESULTS"),
    roundsCompleted: rounds.filter((round) => round.status === "STANDINGS_UPDATED").length,
    tiebreaks: criteria.map((criterion) => criterion.name),
    rows: standings.map((row, index) => ({
      rank: row.rank ?? index + 1,
      playerId: row.playerId,
      name: row.player.user.name,
      score: Number(row.score),
      buchholz: Number(row.buchholz),
      buchholzCut1: Number(row.buchholzCut1),
      sonnebornBerger: Number(row.sonnebornBerger),
      withdrawn: withdrawnIds.has(row.playerId),
    })),
  };
}
