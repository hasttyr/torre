import type { Prisma, PrismaClient, Standing, Tournament } from "@prisma/client";

import type { StandingValues } from "../standings.calculator";

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
 * official ranking (the rank standings.service.ts stored at the last
 * recalculation, so dashboards never disagree with the tournament's own
 * table). Oldest tournament first.
 */
export async function loadRankedTournaments(
  prisma: PrismaClient,
  where: Prisma.TournamentWhereInput,
): Promise<RankedTournament[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { ...where, standings: { some: {} } },
    include: {
      standings: {
        include: { player: { select: { user: { select: { name: true } } } } },
        // Postgres sorts NULL last on ASC: rows from before ranks were
        // stored fall back to their position below.
        orderBy: [{ rank: "asc" }, { score: "desc" }],
      },
    },
    orderBy: { startDate: "asc" },
  });

  return tournaments.map(({ standings, ...tournament }) => ({
    tournament,
    ranking: standings.map((row, index) => ({
      ...toStandingValues(row),
      playerName: row.player.user.name,
      rank: row.rank ?? index + 1,
    })),
  }));
}

/** The player's row in a ranked tournament, if they have one. */
export function standingOf(ranked: RankedTournament, playerId: string): RankedStanding | undefined {
  return ranked.ranking.find((row) => row.playerId === playerId);
}
