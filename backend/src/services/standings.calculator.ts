// Pure standings math (no Prisma, no I/O): used by standings.service.ts on
// every recorded result (HU12) and by the seeder, and unit-tested without a
// database.

import { DEFAULT_TIEBREAKS, DOUBLE_FORFEIT, isForfeit, TIEBREAKS, type Tiebreak } from "../contracts/catalogs";

/** A recorded game as stored in `results.value` (RN-03 catalog). `blackId` is null for a bye. */
export interface RecordedGame {
  whiteId: string | null;
  blackId: string | null;
  value: string;
}

export interface StandingValues {
  playerId: string;
  score: number;
  buchholz: number;
  buchholzCut1: number;
  sonnebornBerger: number;
}

// HU13's catalog and suggested order live in the API contract.
export { DEFAULT_TIEBREAKS, TIEBREAKS, type Tiebreak };

/**
 * Points each side earns for a result value.
 *
 * @param byePoints - What a bye is worth in this tournament (HU28: 1, 0.5 or 0).
 */
export function pointsFor(game: RecordedGame, byePoints = 1): { white: number; black: number } {
  switch (game.value) {
    case "1-0":
    case "1F-0F":
      return { white: 1, black: 0 };
    case "BYE":
      return { white: byePoints, black: 0 };
    case "0-1":
    case "0F-1F":
      return { white: 0, black: 1 };
    case "1/2-1/2":
      return { white: 0.5, black: 0.5 };
    case DOUBLE_FORFEIT:
      return { white: 0, black: 0 };
    default:
      throw new Error(`Unknown result value "${game.value}"`);
  }
}

interface Encounter {
  opponentId: string;
  points: number;
}

/**
 * Computes score and tiebreaks (Buchholz, Buchholz Cut 1, Sonneborn-Berger)
 * for every player that appears in `games`.
 *
 * @remarks
 * Byes add to the player's score but, having no opponent, contribute
 * nothing to their tiebreaks (the simplified rule, not FIDE's "virtual
 * opponent"). A forfeit was never played: its point goes to whoever showed
 * up (1F-0F, 0F-1F; nobody in a double forfeit, 0F-0F), and like FIDE it
 * gives neither player an opponent for the tiebreaks. ARO needs ratings, which are out of this project's scope.
 */
export function computeStandings(games: RecordedGame[], byePoints = 1): StandingValues[] {
  const scores = new Map<string, number>();
  const encounters = new Map<string, Encounter[]>();

  const addScore = (playerId: string, points: number): void => {
    scores.set(playerId, (scores.get(playerId) ?? 0) + points);
    if (!encounters.has(playerId)) encounters.set(playerId, []);
  };

  for (const game of games) {
    const points = pointsFor(game, byePoints);
    if (game.whiteId) addScore(game.whiteId, points.white);
    if (game.blackId) addScore(game.blackId, points.black);
    if (game.whiteId && game.blackId && !isForfeit(game.value)) {
      encounters.get(game.whiteId)!.push({ opponentId: game.blackId, points: points.white });
      encounters.get(game.blackId)!.push({ opponentId: game.whiteId, points: points.black });
    }
  }

  return Array.from(scores.entries()).map(([playerId, score]) => {
    const played = encounters.get(playerId) ?? [];
    const opponentScores = played.map((encounter) => scores.get(encounter.opponentId) ?? 0);
    const buchholz = sum(opponentScores);
    const lowest = opponentScores.length > 0 ? Math.min(...opponentScores) : 0;
    const sonnebornBerger = sum(played.map((encounter) => encounter.points * (scores.get(encounter.opponentId) ?? 0)));
    return { playerId, score, buchholz, buchholzCut1: buchholz - lowest, sonnebornBerger };
  });
}

// Splits players tied so far into groups, best first: one group when the
// criterion can't tell them apart.
type Splitter = <T extends StandingValues>(tied: T[]) => T[][];

/** Groups by a value, highest first. */
const byDescending =
  (valueOf: (row: StandingValues) => number): Splitter =>
  (tied) => {
    const groups = new Map<number, (typeof tied)[number][]>();
    for (const row of tied) {
      const value = valueOf(row);
      groups.set(value, [...(groups.get(value) ?? []), row]);
    }
    return [...groups.entries()].sort(([a], [b]) => b - a).map(([, rows]) => rows);
  };

/**
 * Direct encounter ("resultado particular"): the tied players ranked by what
 * they scored in their games together. As FIDE applies it, only when every
 * one of them met every other: otherwise it doesn't resolve the tie. A
 * cycle (A beat B, B beat C, C beat A) leaves them level, so it doesn't
 * either. A forfeit was never played (decision 011): not a meeting.
 */
function directEncounter(games: RecordedGame[]): Splitter {
  const scoredAgainst = new Map<string, number>();
  for (const game of games) {
    if (!game.whiteId || !game.blackId || isForfeit(game.value)) continue;
    const points = pointsFor(game);
    const whiteKey = `${game.whiteId}>${game.blackId}`;
    const blackKey = `${game.blackId}>${game.whiteId}`;
    scoredAgainst.set(whiteKey, (scoredAgainst.get(whiteKey) ?? 0) + points.white);
    scoredAgainst.set(blackKey, (scoredAgainst.get(blackKey) ?? 0) + points.black);
  }
  const met = (a: string, b: string) => scoredAgainst.has(`${a}>${b}`);

  return (tied) => {
    const ids = tied.map((row) => row.playerId);
    const allMet = ids.every((a) => ids.every((b) => a === b || met(a, b)));
    if (!allMet) return [tied];
    return byDescending((row) => sum(ids.map((other) => scoredAgainst.get(`${row.playerId}>${other}`) ?? 0)))(tied);
  };
}

// Every criterion the calculator can compute (ARO can't: see TIEBREAKS).
function tiebreakSplitters(games: RecordedGame[]): Partial<Record<Tiebreak, Splitter>> {
  return {
    BUCHHOLZ: byDescending((row) => row.buchholz),
    BUCHHOLZ_CUT1: byDescending((row) => row.buchholzCut1),
    SONNEBORN_BERGER: byDescending((row) => row.sonnebornBerger),
    DIRECT_ENCOUNTER: directEncounter(games),
  };
}

/**
 * Ranks standings best-first: score, then each tiebreak in the tournament's
 * configured order (criteria it can't compute, i.e. ARO, are skipped). Falls
 * back to {@link DEFAULT_TIEBREAKS} when the tournament has none configured.
 *
 * Players no criterion tells apart share a place (UC13, HU13: an unresolved
 * tie is shown as such), and the next one counts the places taken: 1, 1, 3.
 * Each criterion splits the groups still tied, instead of comparing players
 * two by two: the direct encounter isn't transitive, and a pairwise sort
 * would have ranked a cycle by whatever order the rows came in.
 *
 * @param games - The tournament's recorded games; only needed by the
 * direct-encounter tiebreak (DIRECT_ENCOUNTER, "resultado particular").
 */
export function rankStandings<T extends StandingValues>(
  rows: T[],
  tiebreaks: readonly Tiebreak[],
  games: RecordedGame[] = [],
): (T & { rank: number })[] {
  const order = tiebreaks.length > 0 ? tiebreaks : DEFAULT_TIEBREAKS;
  const available = tiebreakSplitters(games);
  const splitters = [byDescending((row) => row.score), ...order.flatMap((tiebreak) => available[tiebreak] ?? [])];

  let groups = [rows];
  for (const split of splitters) {
    groups = groups.flatMap((tied) => (tied.length > 1 ? split(tied) : [tied]));
  }

  let place = 1;
  return groups.flatMap((tied) => {
    const ranked = tied.map((row) => ({ ...row, rank: place }));
    place += tied.length;
    return ranked;
  });
}
function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
