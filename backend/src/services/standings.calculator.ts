// Pure standings math (no Prisma, no I/O), so it can be reused by the
// seeder today and by the real round-closing flow (HU10-HU13) later, and
// unit-tested without a database.

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

/** Points each side earns for a result value. A bye gives its only player a full point. */
export function pointsFor(game: RecordedGame): { white: number; black: number } {
  switch (game.value) {
    case "1-0":
    case "BYE":
      return { white: 1, black: 0 };
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
export function computeStandings(games: RecordedGame[]): StandingValues[] {
  const scores = new Map<string, number>();
  const encounters = new Map<string, Encounter[]>();

  const addScore = (playerId: string, points: number): void => {
    scores.set(playerId, (scores.get(playerId) ?? 0) + points);
    if (!encounters.has(playerId)) encounters.set(playerId, []);
  };

  for (const game of games) {
    const points = pointsFor(game);
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

// Tiebreak names are free text (see tournaments.schemas.ts): matched
// loosely so "Buchholz Cortado 1", "buchholz-cut-1" etc. all resolve.
const TIEBREAK_FIELDS: Record<string, keyof Omit<StandingValues, "playerId" | "score">> = {
  buchholz: "buchholz",
  buchholzcortado1: "buchholzCut1",
  buchholzcut1: "buchholzCut1",
  sonnebornberger: "sonnebornBerger",
};

const DEFAULT_TIEBREAKS = ["Buchholz Cortado 1", "Buchholz", "Sonneborn-Berger"];

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

/**
 * Sorts standings best-first: score, then each tiebreak in the tournament's
 * configured order (unknown names, e.g. ARO, are skipped). Falls back to a
 * default order when the tournament has none configured.
 */
export function rankStandings<T extends StandingValues>(rows: T[], tiebreakNames: string[]): T[] {
  const names = tiebreakNames.length > 0 ? tiebreakNames : DEFAULT_TIEBREAKS;
  const fields = names.map((name) => TIEBREAK_FIELDS[normalize(name)]).filter(Boolean);

  return rows.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    for (const field of fields) {
      if (b[field] !== a[field]) return b[field] - a[field];
    }
    return 0;
  });
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
