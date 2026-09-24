import type { PrismaClient } from "@prisma/client";

import { computeStandings, type RecordedGame } from "../../src/services/standings.calculator";

// Plays out a tournament's rounds so dashboards have real history to show:
// rounds, matches, results and standings computed with the same calculator
// the app uses (src/services/standings.calculator.ts). The pairing below is
// a deliberately simple Swiss approximation for demo data only — the real
// pairing engine (HU08, FIDE Dutch) is a separate piece of work.

export interface CompetitionSeed {
  tournamentId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  playerIds: string[];
  // Rounds fully played and recorded.
  completedRounds: number;
  // Adds one more round with only half of its boards recorded (a tournament
  // caught mid-round, for IN_PROGRESS demos).
  partialRound?: boolean;
}

const DEFAULT_TIEBREAKS = ["Buchholz Cortado 1", "Buchholz", "Sonneborn-Berger"];
// Chance of a draw between any two players; the rest is decided by strength.
const DRAW_RATE = 0.22;
// Elo-points equivalent of moving first.
const WHITE_ADVANTAGE = 35;

interface SimulatedGame extends RecordedGame {
  round: number;
  board: number;
  // false = still being played (only in a partial round): the match is
  // persisted, its result isn't.
  recorded: boolean;
}

/** Small deterministic PRNG (mulberry32), seeded from the tournament name so re-seeding a fresh DB gives the same history. */
function createRng(seedText: string): () => number {
  // `| 0` here is int32 wrap-around (the algorithm's arithmetic), not truncation.
  let state = Array.from(seedText).reduce((hash, char) => (Math.imul(hash, 31) + char.codePointAt(0)!) | 0, 7);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateResult(rng: () => number, whiteStrength: number, blackStrength: number): string {
  if (rng() < DRAW_RATE) return "1/2-1/2";
  const whiteExpected = 1 / (1 + 10 ** ((blackStrength - whiteStrength - WHITE_ADVANTAGE) / 400));
  return rng() < whiteExpected ? "1-0" : "0-1";
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Pairs top-down by score, avoiding rematches when possible; returns [white, black] pairs. */
function pairRound(ordered: string[], alreadyMet: Set<string>, whitesCount: Map<string, number>): [string, string][] {
  const pending = [...ordered];
  const pairs: [string, string][] = [];
  while (pending.length >= 2) {
    const first = pending.shift()!;
    const index = pending.findIndex((candidate) => !alreadyMet.has(pairKey(first, candidate)));
    const [second] = pending.splice(index === -1 ? 0 : index, 1);
    // Whoever has had white fewer times gets it.
    pairs.push((whitesCount.get(first) ?? 0) <= (whitesCount.get(second) ?? 0) ? [first, second] : [second, first]);
  }
  return pairs;
}

function simulate(seed: CompetitionSeed, strengthOf: (playerId: string) => number): SimulatedGame[] {
  const rng = createRng(seed.name);
  const games: SimulatedGame[] = [];
  const alreadyMet = new Set<string>();
  const hadBye = new Set<string>();
  const whitesCount = new Map<string, number>();
  const totalRounds = seed.completedRounds + (seed.partialRound ? 1 : 0);

  for (let round = 1; round <= totalRounds; round++) {
    const scores = new Map(
      computeStandings(games.filter((game) => game.recorded)).map((row) => [row.playerId, row.score]),
    );
    const ordered = [...seed.playerIds].sort(
      (a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || strengthOf(b) - strengthOf(a),
    );

    const isPartial = round > seed.completedRounds;
    let board = 1;

    if (ordered.length % 2 === 1) {
      // Bye to the lowest-ranked player who hasn't had one yet.
      const byeIndex = ordered
        .map((id, index) => ({ id, index }))
        .reverse()
        .find(({ id }) => !hadBye.has(id))!.index;
      const [byePlayer] = ordered.splice(byeIndex, 1);
      hadBye.add(byePlayer);
      games.push({
        round,
        board: ordered.length / 2 + 1,
        whiteId: byePlayer,
        blackId: null,
        value: "BYE",
        recorded: true,
      });
    }

    const pairs = pairRound(ordered, alreadyMet, whitesCount);
    pairs.forEach(([whiteId, blackId], index) => {
      alreadyMet.add(pairKey(whiteId, blackId));
      whitesCount.set(whiteId, (whitesCount.get(whiteId) ?? 0) + 1);
      const recorded = !isPartial || index < Math.ceil(pairs.length / 2);
      games.push({
        round,
        board: board++,
        whiteId,
        blackId,
        value: simulateResult(rng, strengthOf(whiteId), strengthOf(blackId)),
        recorded,
      });
    });
  }

  return games;
}

/** Date a round is played on: rounds spread evenly across the tournament's days, starting at 9:00. */
function roundDate(seed: CompetitionSeed, round: number, totalRounds: number): Date {
  const days = Math.round((seed.endDate.getTime() - seed.startDate.getTime()) / 86_400_000) + 1;
  const date = new Date(seed.startDate);
  date.setUTCDate(date.getUTCDate() + Math.floor(((round - 1) * days) / totalRounds));
  date.setUTCHours(14 + ((round - 1) % 3) * 3); // 9:00, 12:00, 15:00 Colombia time
  return date;
}

/**
 * Plays out and persists a tournament's history. Idempotent: a tournament
 * that already has rounds is left untouched.
 *
 * @returns whether anything was written.
 */
export async function seedCompetitionHistory(
  prisma: PrismaClient,
  seed: CompetitionSeed,
  strengthOf: (playerId: string) => number,
): Promise<boolean> {
  if ((await prisma.round.count({ where: { tournamentId: seed.tournamentId } })) > 0) {
    return false;
  }

  const games = simulate(seed, strengthOf);
  const totalRounds = seed.completedRounds + (seed.partialRound ? 1 : 0);
  const standings = computeStandings(games.filter((game) => game.recorded));

  await prisma.$transaction(
    async (tx) => {
      if ((await tx.tiebreakCriterion.count({ where: { tournamentId: seed.tournamentId } })) === 0) {
        await tx.tiebreakCriterion.createMany({
          data: DEFAULT_TIEBREAKS.map((name, index) => ({ tournamentId: seed.tournamentId, name, order: index + 1 })),
        });
      }

      for (let round = 1; round <= totalRounds; round++) {
        const playedAt = roundDate(seed, round, totalRounds);
        await tx.round.create({
          data: {
            tournamentId: seed.tournamentId,
            number: round,
            status: round > seed.completedRounds ? "RECORDING_RESULTS" : "STANDINGS_UPDATED",
            createdAt: playedAt,
            matches: {
              create: games
                .filter((game) => game.round === round)
                .map((game) => ({
                  board: game.board,
                  whiteId: game.whiteId,
                  blackId: game.blackId,
                  status: game.recorded ? "FINISHED" : "IN_PROGRESS",
                  createdAt: playedAt,
                  ...(game.recorded
                    ? {
                        result: {
                          create: {
                            value: game.value,
                            recordedAt: new Date(playedAt.getTime() + (100 + game.board * 7) * 60_000),
                          },
                        },
                      }
                    : {}),
                })),
            },
          },
        });
      }

      await tx.standing.createMany({
        data: standings.map((row) => ({ tournamentId: seed.tournamentId, ...row })),
      });
    },
    { timeout: 30_000 },
  );

  return true;
}
