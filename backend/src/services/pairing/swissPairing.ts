// HU08/HU28: the adapted Swiss pairing engine. Pure (no Prisma, no I/O):
// rounds.service.ts gathers each active player's history and persists the
// result; everything that decides WHO plays WHOM lives here, unit-tested.
//
// "Adapted" Dutch system (FIDE C.04.3), deliberately simplified:
// - players are ranked by score, then by pairing number (the round-1 draw);
// - within a score group the top half meets the bottom half (1 vs n/2+1,
//   2 vs n/2+2, ...); whoever can't be paired inside their group floats down
//   to the next one;
// - nobody meets the same opponent twice (RN-02): a backtracking search
//   tries the next-best opponent when a choice leads to a dead end;
// - an odd field gives a bye to the lowest-ranked player who hasn't had one
//   (RN-08, FIDE basic Swiss rules art. 3);
// - colors equalize first, then alternate.
// Withdrawn players (RN-07) are simply never passed in.

export type Color = "W" | "B";

export interface PairingCandidate {
  id: string;
  score: number;
  // Lower = ranked higher among equal scores. Stable for the whole tournament.
  pairingNumber: number;
  opponents: ReadonlySet<string>;
  // Colors played so far, in round order (byes excluded).
  colors: readonly Color[];
  hadBye: boolean;
}

export interface Pairing {
  whiteId: string;
  blackId: string;
}

export interface RoundPairing {
  // In board order: board 1 first.
  pairings: Pairing[];
  byeId: string | null;
}

/** No pairing exists that respects RN-02 (every option repeats a game). */
export class PairingImpossibleError extends Error {
  constructor() {
    super("No existe un emparejamiento que evite repetir enfrentamientos");
  }
}

// Upper bound on backtracking steps: far beyond what a university-sized
// field needs, but guarantees the request finishes instead of hanging on
// a pathological history.
const MAX_SEARCH_STEPS = 200_000;

function byRanking(a: PairingCandidate, b: PairingCandidate): number {
  return b.score - a.score || a.pairingNumber - b.pairingNumber;
}

/**
 * The opponents `player` (the highest-ranked unpaired player) should try, best
 * first: the bottom half of their own score group, then the rest of their
 * group, then lower groups (a downfloat).
 */
function opponentPreference(player: PairingCandidate, remaining: PairingCandidate[]): PairingCandidate[] {
  const group = remaining.filter((candidate) => candidate.score === player.score);
  const topHalfSize = Math.max(1, Math.floor(group.length / 2));
  return [
    ...group.slice(topHalfSize),
    ...group.slice(1, topHalfSize),
    ...remaining.filter((candidate) => candidate.score < player.score),
  ];
}

/** Pairs everyone in `ranked` (even count) without rematches, or returns null. */
function pairAll(ranked: PairingCandidate[], budget: { steps: number }): [PairingCandidate, PairingCandidate][] | null {
  if (ranked.length === 0) return [];
  if (--budget.steps < 0) throw new PairingImpossibleError();

  const [player, ...rest] = ranked;
  for (const opponent of opponentPreference(player, ranked)) {
    if (player.opponents.has(opponent.id)) continue;
    const others = pairAll(
      rest.filter((candidate) => candidate !== opponent),
      budget,
    );
    if (others) return [[player, opponent], ...others];
  }
  return null;
}

/** Whites minus blacks, nudged by the last color so ties alternate. Lower = more deserving of white. */
function whiteNeed(player: PairingCandidate): number {
  const balance = player.colors.filter((color) => color === "W").length * 2 - player.colors.length;
  const last = player.colors.at(-1);
  return balance * 10 + (last === "W" ? 1 : last === "B" ? -1 : 0);
}

/** Decides colors for `higher` (the better-ranked player) vs `lower` on a given board. */
function allocateColors(higher: PairingCandidate, lower: PairingCandidate, board: number): Pairing {
  const higherNeed = whiteNeed(higher);
  const lowerNeed = whiteNeed(lower);
  // Equal needs (e.g. round 1): the higher-ranked player takes white on odd
  // boards and black on even ones, so colors spread evenly down the room.
  const higherGetsWhite = higherNeed === lowerNeed ? board % 2 === 1 : higherNeed < lowerNeed;
  return higherGetsWhite ? { whiteId: higher.id, blackId: lower.id } : { whiteId: lower.id, blackId: higher.id };
}

/**
 * Pairs one round.
 *
 * @throws {PairingImpossibleError} when no pairing avoids a rematch; the
 * organizer then needs a manual adjustment (HU29), which RN-02 allows.
 */
export function pairRound(players: PairingCandidate[]): RoundPairing {
  const ranked = [...players].sort(byRanking);
  const budget = { steps: MAX_SEARCH_STEPS };

  // Odd field: try bye candidates from the bottom up (RN-08: only players
  // without a previous bye, unless literally everyone has had one), and
  // keep the first choice that lets everyone else be paired.
  const byeCandidates =
    ranked.length % 2 === 0
      ? [null]
      : (() => {
          const bottomUp = [...ranked].reverse();
          const eligible = bottomUp.filter((player) => !player.hadBye);
          return eligible.length > 0 ? eligible : bottomUp;
        })();

  for (const bye of byeCandidates) {
    const pairs = pairAll(
      ranked.filter((player) => player !== bye),
      budget,
    );
    if (pairs) {
      return {
        pairings: pairs.map(([higher, lower], index) => allocateColors(higher, lower, index + 1)),
        byeId: bye?.id ?? null,
      };
    }
  }

  throw new PairingImpossibleError();
}
