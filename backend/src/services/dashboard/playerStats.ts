import { pointsFor, type RecordedGame } from "../standings.calculator";

// Pure per-player game statistics (no Prisma): shared by every widget that
// shows win/draw/loss numbers, so "a win" is counted in exactly one place.

export interface ResultTally {
  wins: number;
  draws: number;
  losses: number;
}

export interface PlayerTally {
  white: ResultTally;
  black: ResultTally;
  byes: number;
}

export interface PlayerTotals extends ResultTally {
  games: number;
  byes: number;
  points: number;
  // Points per game actually played (0-1), null before the first game.
  // Byes are excluded: they're not a performance.
  scoreRate: number | null;
}

export function emptyTally(): PlayerTally {
  return { white: { wins: 0, draws: 0, losses: 0 }, black: { wins: 0, draws: 0, losses: 0 }, byes: 0 };
}

function record(tally: ResultTally, points: number): void {
  if (points === 1) tally.wins += 1;
  else if (points === 0) tally.losses += 1;
  else tally.draws += 1;
}

/** Tallies wins/draws/losses by color (and byes) for every player appearing in `games`. */
export function tallyGames(games: RecordedGame[]): Map<string, PlayerTally> {
  const tallies = new Map<string, PlayerTally>();
  const tallyOf = (playerId: string): PlayerTally => {
    let tally = tallies.get(playerId);
    if (!tally) {
      tally = emptyTally();
      tallies.set(playerId, tally);
    }
    return tally;
  };

  for (const game of games) {
    if (game.value === "BYE" || !game.whiteId || !game.blackId) {
      const playerId = game.whiteId ?? game.blackId;
      if (playerId) tallyOf(playerId).byes += 1;
      continue;
    }
    const points = pointsFor(game);
    record(tallyOf(game.whiteId).white, points.white);
    record(tallyOf(game.blackId).black, points.black);
  }

  return tallies;
}

/** Points per game played (0-1), or null before the first game. */
export function scoreRateOf({ wins, draws, losses }: ResultTally): number | null {
  const games = wins + draws + losses;
  return games > 0 ? (wins + draws / 2) / games : null;
}

/** Collapses a by-color tally into overall totals. */
export function totalsOf(tally: PlayerTally): PlayerTotals {
  const overall: ResultTally = {
    wins: tally.white.wins + tally.black.wins,
    draws: tally.white.draws + tally.black.draws,
    losses: tally.white.losses + tally.black.losses,
  };
  return {
    ...overall,
    games: overall.wins + overall.draws + overall.losses,
    byes: tally.byes,
    points: overall.wins + overall.draws / 2 + tally.byes,
    scoreRate: scoreRateOf(overall),
  };
}
