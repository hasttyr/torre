import type { PrismaClient } from "../generated/prisma/client";

import type { AuthUser } from "../types/express";
import { assertCanViewTournament, loadTournament } from "./tournamentAccess";
import type { BoardResults, RoundStatsDto, TournamentStatsDto } from "../contracts/responses";

// HU16: aggregate statistics of one tournament, computed from its official
// (published) games only, like the standings (RN-04).

export interface BoardGame {
  round: number;
  isBye: boolean;
  // null while the game has no result yet.
  value: string | null;
}

function emptyBoardResults(): BoardResults {
  return { whiteWins: 0, draws: 0, blackWins: 0 };
}

function count(results: BoardResults, value: string): void {
  if (value === "1-0") results.whiteWins += 1;
  else if (value === "0-1") results.blackWins += 1;
  else if (value === "1/2-1/2") results.draws += 1;
}

/** Pure aggregation of a tournament's boards into totals and per-round figures. */
export function summarizeBoards(
  games: BoardGame[],
): Omit<TournamentStatsDto, "tournamentId" | "activePlayers" | "withdrawnPlayers"> {
  const totals = emptyBoardResults();
  const perRound = new Map<number, RoundStatsDto>();
  let byes = 0;

  for (const game of games) {
    if (game.isBye) {
      byes += 1;
      continue;
    }
    const round = perRound.get(game.round) ?? { round: game.round, ...emptyBoardResults(), pending: 0 };
    perRound.set(game.round, round);
    if (game.value === null) {
      round.pending += 1;
      continue;
    }
    count(round, game.value);
    count(totals, game.value);
  }

  const gamesPlayed = totals.whiteWins + totals.draws + totals.blackWins;
  return {
    ...totals,
    gamesPlayed,
    byes,
    decisiveRate: gamesPlayed > 0 ? (totals.whiteWins + totals.blackWins) / gamesPlayed : null,
    whiteScoreRate: gamesPlayed > 0 ? (totals.whiteWins + totals.draws / 2) / gamesPlayed : null,
    rounds: [...perRound.values()].sort((a, b) => a.round - b.round),
  };
}

/**
 * HU16: the tournament's statistics. Same visibility as its standings: its
 * managers always, everyone else once it's past the preliminary state.
 */
export async function getTournamentStats(
  prisma: PrismaClient,
  tournamentId: string,
  viewer: AuthUser,
): Promise<TournamentStatsDto> {
  const tournament = await loadTournament(prisma, tournamentId);
  assertCanViewTournament(tournament, viewer);

  const [matches, activePlayers, withdrawnPlayers] = await Promise.all([
    prisma.match.findMany({
      where: { round: { tournamentId, status: { not: "GENERATED" } } },
      select: {
        whiteId: true,
        blackId: true,
        result: { select: { value: true } },
        round: { select: { number: true } },
      },
    }),
    prisma.enrollment.count({ where: { tournamentId, withdrawnAt: null } }),
    prisma.enrollment.count({ where: { tournamentId, withdrawnAt: { not: null } } }),
  ]);

  return {
    tournamentId,
    activePlayers,
    withdrawnPlayers,
    ...summarizeBoards(
      matches.map((match) => ({
        round: match.round.number,
        isBye: !match.whiteId || !match.blackId,
        value: match.result?.value ?? null,
      })),
    ),
  };
}

export type { BoardResults, RoundStatsDto, TournamentStatsDto };
