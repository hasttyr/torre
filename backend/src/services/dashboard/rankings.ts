import type { Prisma, PrismaClient, Standing, Tournament } from "@prisma/client";

import { rankStandings, type StandingValues } from "../standings.calculator";

export interface RankedStanding extends StandingValues {
  playerName: string;
  rank: number;
}

export interface RankedTournament {
  tournament: Tournament;
  // Best first; rank is 1-based.
  ranking: RankedStanding[];
}

function toStandingValues(row: Standing): StandingValues {
  return {
    playerId: row.playerId,
    score: Number(row.score),
    buchholz: Number(row.buchholz),
    buchholzCut1: Number(row.buchholzCut1),
    sonnebornBerger: Number(row.sonnebornBerger),
  };
}

/**
 * Loads the tournaments matching `where` that have standings, each with its
 * standings ranked by score and the tournament's own tiebreak order. Oldest
 * tournament first.
 */
export async function loadRankedTournaments(
  prisma: PrismaClient,
  where: Prisma.TournamentWhereInput,
): Promise<RankedTournament[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { ...where, standings: { some: {} } },
    include: {
      tiebreakCriteria: { orderBy: { order: "asc" } },
      standings: { include: { player: { select: { user: { select: { name: true } } } } } },
    },
    orderBy: { startDate: "asc" },
  });

  return tournaments.map(({ standings, tiebreakCriteria, ...tournament }) => {
    const rows = standings.map((row) => ({ ...toStandingValues(row), playerName: row.player.user.name }));
    const ranked = rankStandings(
      rows,
      tiebreakCriteria.map((criterion) => criterion.name),
    );
    return { tournament, ranking: ranked.map((row, index) => ({ ...row, rank: index + 1 })) };
  });
}

/** The player's row in a ranked tournament, if they have one. */
export function standingOf(ranked: RankedTournament, playerId: string): RankedStanding | undefined {
  return ranked.ranking.find((row) => row.playerId === playerId);
}
