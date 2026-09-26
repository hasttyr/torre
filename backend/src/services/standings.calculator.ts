// Pure standings math (no Prisma, no I/O): used by standings.service.ts on
// every recorded result (HU12) and by the seeder, and unit-tested without a
// database.

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

// HU13's order. ARO is listed because the documentation lists it, but it's
// skipped when ranking: it needs ratings, which are out of scope.
export const DEFAULT_TIEBREAKS = ["Buchholz", "Buchholz Cortado 1", "Sonneborn-Berger", "ARO", "Resultado particular"];

/**
 * Points each side earns for a result value.
 *
 * @param byePoints - What a bye is worth in this tournament (HU28: 1, 0.5 or 0).
 */
export function pointsFor(game: RecordedGame, byePoints = 1): { white: number; black: number } {
  switch (game.value) {
    case "1-0":
      return { white: 1, black: 0 };
    case "BYE":
      return { white: byePoints, black: 0 };
    case "0-1":
      return { white: 0, black: 1 };
    case "1/2-1/2":
      return { white: 0.5, black: 0.5 };
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
 * opponent"). ARO needs ratings, which are out of this project's scope.
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
    if (game.whiteId && game.blackId) {
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

// Negative when `a` ranks ahead of `b`, like Array#sort's comparator.
type Comparator = (a: StandingValues, b: StandingValues) => number;

const byDescending =
  (field: "buchholz" | "buchholzCut1" | "sonnebornBerger"): Comparator =>
  (a, b) =>
    b[field] - a[field];

/** Direct encounter: whoever scored more against the other in their games together ranks first. */
function directEncounter(games: RecordedGame[]): Comparator {
  const scoredAgainst = new Map<string, number>();
  for (const game of games) {
    if (!game.whiteId || !game.blackId) continue;
    const points = pointsFor(game);
    const whiteKey = `${game.whiteId}>${game.blackId}`;
    const blackKey = `${game.blackId}>${game.whiteId}`;
    scoredAgainst.set(whiteKey, (scoredAgainst.get(whiteKey) ?? 0) + points.white);
    scoredAgainst.set(blackKey, (scoredAgainst.get(blackKey) ?? 0) + points.black);
  }
  return (a, b) =>
    (scoredAgainst.get(`${b.playerId}>${a.playerId}`) ?? 0) - (scoredAgainst.get(`${a.playerId}>${b.playerId}`) ?? 0);
}

// Tiebreak names are free text (see tournaments.schemas.ts): matched
// loosely so "Buchholz Cortado 1", "buchholz-cut-1" etc. all resolve.
function tiebreakComparators(games: RecordedGame[]): Record<string, Comparator> {
  const direct = directEncounter(games);
  return {
    buchholz: byDescending("buchholz"),
    buchholzcortado1: byDescending("buchholzCut1"),
    buchholzcut1: byDescending("buchholzCut1"),
    sonnebornberger: byDescending("sonnebornBerger"),
    resultadoparticular: direct,
    directencounter: direct,
  };
}

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Sorts standings best-first: score, then each tiebreak in the tournament's
 * configured order (names it can't compute, e.g. ARO, are skipped). Falls
 * back to {@link DEFAULT_TIEBREAKS} when the tournament has none configured.
 *
 * @param games - The tournament's recorded games; only needed by the
 * direct-encounter tiebreak ("Resultado particular").
 */
export function rankStandings<T extends StandingValues>(
  rows: T[],
  tiebreakNames: string[],
  games: RecordedGame[] = [],
): T[] {
  const names = tiebreakNames.length > 0 ? tiebreakNames : DEFAULT_TIEBREAKS;
  const available = tiebreakComparators(games);
  const comparators = names.map((name) => available[normalize(name)]).filter(Boolean);

  return rows.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    for (const compare of comparators) {
      const order = compare(a, b);
      if (order !== 0) return order;
    }
    return 0;
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
