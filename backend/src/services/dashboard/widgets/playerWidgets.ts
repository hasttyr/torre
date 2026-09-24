import type { PrismaClient } from "@prisma/client";

import type { RecordedGame } from "../../standings.calculator";
import { emptyTally, scoreRateOf, tallyGames, totalsOf, type PlayerTotals, type ResultTally } from "../playerStats";
import { loadRankedTournaments, standingOf } from "../rankings";

// Widgets about ONE player (the dashboard's selected subject). Callers have
// already checked the viewer may see this player (see dashboard.service.ts).

interface TournamentGame extends RecordedGame {
  tournamentId: string;
}

/** Every recorded game the player took part in, with the tournament it belongs to. */
async function loadPlayerGames(prisma: PrismaClient, playerId: string): Promise<TournamentGame[]> {
  const matches = await prisma.match.findMany({
    where: { result: { isNot: null }, OR: [{ whiteId: playerId }, { blackId: playerId }] },
    select: {
      whiteId: true,
      blackId: true,
      result: { select: { value: true } },
      round: { select: { tournamentId: true } },
    },
  });

  return matches.map((match) => ({
    whiteId: match.whiteId,
    blackId: match.blackId,
    value: match.result!.value,
    tournamentId: match.round.tournamentId,
  }));
}

export interface PlayerSummaryDto extends PlayerTotals {
  tournamentsPlayed: number;
  titles: number;
  bestFinish: number | null;
}

/** PLAYER_SUMMARY: headline numbers across the player's whole career. */
export async function loadPlayerSummary(prisma: PrismaClient, playerId: string): Promise<PlayerSummaryDto> {
  const [games, ranked] = await Promise.all([
    loadPlayerGames(prisma, playerId),
    loadRankedTournaments(prisma, { standings: { some: { playerId } } }),
  ]);

  const finishes = ranked
    .filter((entry) => entry.tournament.status === "FINISHED")
    .map((entry) => standingOf(entry, playerId)!.rank);

  return {
    ...totalsOf(tallyGames(games).get(playerId) ?? emptyTally()),
    tournamentsPlayed: ranked.length,
    titles: finishes.filter((rank) => rank === 1).length,
    bestFinish: finishes.length > 0 ? Math.min(...finishes) : null,
  };
}

export interface PerformancePointDto {
  tournamentId: string;
  name: string;
  startDate: Date;
  scoreRate: number;
  points: number;
  games: number;
  rank: number;
  participants: number;
}

/** PLAYER_PERFORMANCE_TREND: score rate per tournament, oldest first. */
export async function loadPlayerPerformanceTrend(
  prisma: PrismaClient,
  playerId: string,
): Promise<PerformancePointDto[]> {
  const [games, ranked] = await Promise.all([
    loadPlayerGames(prisma, playerId),
    loadRankedTournaments(prisma, { standings: { some: { playerId } } }),
  ]);

  return ranked.flatMap(({ tournament, ranking }) => {
    const totals = totalsOf(
      tallyGames(games.filter((game) => game.tournamentId === tournament.id)).get(playerId) ?? emptyTally(),
    );
    // A tournament with only a bye (or none recorded yet) has no rate to plot.
    if (totals.scoreRate === null) return [];
    return [
      {
        tournamentId: tournament.id,
        name: tournament.name,
        startDate: tournament.startDate,
        scoreRate: totals.scoreRate,
        points: totals.points,
        games: totals.games,
        rank: standingOf({ tournament, ranking }, playerId)!.rank,
        participants: ranking.length,
      },
    ];
  });
}

export interface ColorResultsDto extends ResultTally {
  scoreRate: number | null;
}

export interface ResultsByColorDto {
  white: ColorResultsDto;
  black: ColorResultsDto;
}

/** PLAYER_RESULTS_BY_COLOR: wins/draws/losses (and score rate) playing white vs black. */
export async function loadPlayerResultsByColor(prisma: PrismaClient, playerId: string): Promise<ResultsByColorDto> {
  const tally = tallyGames(await loadPlayerGames(prisma, playerId)).get(playerId) ?? emptyTally();
  return {
    white: { ...tally.white, scoreRate: scoreRateOf(tally.white) },
    black: { ...tally.black, scoreRate: scoreRateOf(tally.black) },
  };
}

export interface TournamentHistoryEntryDto {
  tournamentId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  withdrawn: boolean;
  // null while the tournament has no standings yet (not started).
  rank: number | null;
  participants: number | null;
  points: number | null;
  buchholz: number | null;
}

/** PLAYER_TOURNAMENT_HISTORY: every tournament the player enrolled in, newest first. */
export async function loadPlayerTournamentHistory(
  prisma: PrismaClient,
  playerId: string,
): Promise<TournamentHistoryEntryDto[]> {
  const [enrollments, ranked] = await Promise.all([
    prisma.enrollment.findMany({
      where: { playerId },
      include: { tournament: true },
      orderBy: { tournament: { startDate: "desc" } },
    }),
    loadRankedTournaments(prisma, { standings: { some: { playerId } } }),
  ]);
  const rankedById = new Map(ranked.map((entry) => [entry.tournament.id, entry]));

  return enrollments.map(({ tournament, withdrawnAt }) => {
    const entry = rankedById.get(tournament.id);
    const standing = entry ? standingOf(entry, playerId) : undefined;
    return {
      tournamentId: tournament.id,
      name: tournament.name,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      status: tournament.status,
      withdrawn: withdrawnAt !== null,
      rank: standing?.rank ?? null,
      participants: entry?.ranking.length ?? null,
      points: standing?.score ?? null,
      buchholz: standing?.buchholz ?? null,
    };
  });
}
