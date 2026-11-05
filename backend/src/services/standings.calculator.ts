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

/** One round as it counts in a player's own tiebreaks. */
interface Contribution {
  // The opponent's score: a real one's, or the dummy's for an unplayed round.
  opponentScore: number;
  // What the player scored in that round.
  points: number;
  // FIDE's "voluntary unplayed round" (16.1.2): here, a forfeit loss.
  voluntary: boolean;
}

/** A round a player didn't play, before its dummy's score is known (it depends on the final scores). */
interface Unplayed {
  points: number;
  voluntary: boolean;
  // A forfeit's scheduled opponent caps the dummy's score (16.4.1); a bye has none.
  scheduledOpponentId: string | null;
}

export interface StandingsOptions {
  /** The tournament's rounds: the dummy's score is capped at a draw's points times them (16.4.2). */
  roundsCount?: number | null;
}

/**
 * Computes score and tiebreaks (Buchholz, Buchholz Cut 1, Sonneborn-Berger)
 * for every player that appears in `games`.
 *
 * @remarks
 * Unplayed rounds follow FIDE's tie-break regulations (C.07, in force from
 * 1 March 2026, art. 16; decision 012). A bye or a forfeit (1F-0F, 0F-1F,
 * 0F-0F) scores its points. For the player's own Buchholz and
 * Sonneborn-Berger it's a game against a dummy whose score is the player's
 * own, capped at a draw's points times the rounds (16.4.2) and, for a
 * forfeit, at the absent opponent's score (16.4.1); the result against it
 * is the points the round awarded (16.4). In the opponents' tiebreaks a
 * player's score counts as is (16.3). Cut 1 removes a forfeit loss before
 * the lowest opponent (16.5). ARO needs ratings, which are out of this
 * project's scope.
 */
export function computeStandings(
  games: RecordedGame[],
  byePoints = 1,
  options: StandingsOptions = {},
): StandingValues[] {
  const scores = new Map<string, number>();
  const played = new Map<string, { opponentId: string; points: number }[]>();
  const unplayed = new Map<string, Unplayed[]>();

  const addScore = (playerId: string, points: number): void => {
    scores.set(playerId, (scores.get(playerId) ?? 0) + points);
    if (!played.has(playerId)) played.set(playerId, []);
    if (!unplayed.has(playerId)) unplayed.set(playerId, []);
  };

  for (const game of games) {
    const points = pointsFor(game, byePoints);
    if (game.whiteId) addScore(game.whiteId, points.white);
    if (game.blackId) addScore(game.blackId, points.black);
    if (!game.whiteId || !game.blackId) {
      const alone = (game.whiteId ?? game.blackId)!;
      unplayed.get(alone)!.push({ points: points.white, voluntary: false, scheduledOpponentId: null });
    } else if (isForfeit(game.value)) {
      unplayed.get(game.whiteId)!.push({
        points: points.white,
        voluntary: points.white === 0,
        scheduledOpponentId: game.blackId,
      });
      unplayed.get(game.blackId)!.push({
        points: points.black,
        voluntary: points.black === 0,
        scheduledOpponentId: game.whiteId,
      });
    } else {
      played.get(game.whiteId)!.push({ opponentId: game.blackId, points: points.white });
      played.get(game.blackId)!.push({ opponentId: game.whiteId, points: points.black });
    }
  }

  // 16.4.2: never above a draw's points times the tournament's rounds.
  const cap = options.roundsCount ? options.roundsCount / 2 : Infinity;
  const scoreOf = (playerId: string) => scores.get(playerId) ?? 0;

  return Array.from(scores.entries()).map(([playerId, score]) => {
    const contributions: Contribution[] = [
      ...played.get(playerId)!.map((game) => ({
        opponentScore: scoreOf(game.opponentId),
        points: game.points,
        voluntary: false,
      })),
      ...unplayed.get(playerId)!.map((round) => ({
        opponentScore: Math.min(score, cap, round.scheduledOpponentId ? scoreOf(round.scheduledOpponentId) : Infinity),
        points: round.points,
        voluntary: round.voluntary,
      })),
    ];
    const buchholz = sum(contributions.map((round) => round.opponentScore));
    const sonnebornBerger = sum(contributions.map((round) => round.points * round.opponentScore));
    return { playerId, score, buchholz, buchholzCut1: buchholz - cutOne(contributions), sonnebornBerger };
  });
}

/**
 * What Buchholz Cut 1 removes: the least significant opponent, or, if the
 * player has a voluntary unplayed round (a forfeit loss), the lowest of
 * those instead (16.5).
 */
function cutOne(contributions: Contribution[]): number {
  const voluntary = contributions.filter((round) => round.voluntary);
  const candidates = voluntary.length > 0 ? voluntary : contributions;
  return candidates.length > 0 ? Math.min(...candidates.map((round) => round.opponentScore)) : 0;
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
