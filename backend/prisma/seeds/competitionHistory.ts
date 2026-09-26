import type { PrismaClient } from "@prisma/client";

import { candidatesFromHistory, drawPairingNumbers, type PlayedGame } from "../../src/services/pairing/pairingHistory";
import { pairRound } from "../../src/services/pairing/swissPairing";
import { DEFAULT_TIEBREAKS } from "../../src/services/standings.calculator";
import { recalculateStandings } from "../../src/services/standings.service";

// Plays out a tournament's rounds so dashboards and standings have real
// history to show. Only the RESULTS are simulated (by playing strength):
// pairings come from the app's own engine (src/services/pairing/) and
// standings from the app's own recalculation, so seeded data is exactly
// what the real flow would have produced.

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

// Chance of a draw between any two players; the rest is decided by strength.
const DRAW_RATE = 0.22;
// Elo-points equivalent of moving first.
const WHITE_ADVANTAGE = 35;

interface SimulatedGame extends PlayedGame {
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

function simulate(
  seed: CompetitionSeed,
  pairingNumbers: Map<string, number>,
  strengthOf: (playerId: string) => number,
  rng: () => number,
): SimulatedGame[] {
  const players = seed.playerIds.map((id) => ({ id, pairingNumber: pairingNumbers.get(id)! }));
  const games: SimulatedGame[] = [];
  const totalRounds = seed.completedRounds + (seed.partialRound ? 1 : 0);

  for (let round = 1; round <= totalRounds; round++) {
    const played = games.filter((game) => game.recorded);
    const { pairings, byeId } = pairRound(candidatesFromHistory(players, played, 1));
    const isPartial = round > seed.completedRounds;

    pairings.forEach(({ whiteId, blackId }, index) => {
      games.push({
        round,
        board: index + 1,
        whiteId,
        blackId,
        value: simulateResult(rng, strengthOf(whiteId), strengthOf(blackId)),
        recorded: !isPartial || index < Math.ceil(pairings.length / 2),
      });
    });
    if (byeId) {
      games.push({ round, board: pairings.length + 1, whiteId: byeId, blackId: null, value: "BYE", recorded: true });
    }
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

  const rng = createRng(seed.name);
  const pairingNumbers = drawPairingNumbers(seed.playerIds, rng);
  const games = simulate(seed, pairingNumbers, strengthOf, rng);
  const totalRounds = seed.completedRounds + (seed.partialRound ? 1 : 0);

  await prisma.$transaction(
    async (tx) => {
      if ((await tx.tiebreakCriterion.count({ where: { tournamentId: seed.tournamentId } })) === 0) {
        await tx.tiebreakCriterion.createMany({
          data: DEFAULT_TIEBREAKS.map((name, index) => ({ tournamentId: seed.tournamentId, name, order: index + 1 })),
        });
      }

      for (const [playerId, pairingNumber] of pairingNumbers) {
        await tx.enrollment.update({
          where: { tournamentId_playerId: { tournamentId: seed.tournamentId, playerId } },
          data: { pairingNumber },
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

      await recalculateStandings(tx, seed.tournamentId);
    },
    { timeout: 30_000 },
  );

  return true;
}

/**
 * Rebuilds the standings of every tournament that has rounds, with the
 * app's current rules (stored rank, tiebreak order, bye value). Keeps a
 * database seeded by an older version of this script consistent; being a
 * pure rebuild, running it again changes nothing.
 */
export async function refreshAllStandings(prisma: PrismaClient): Promise<number> {
  const tournaments = await prisma.tournament.findMany({ where: { rounds: { some: {} } }, select: { id: true } });
  for (const { id } of tournaments) {
    await prisma.$transaction((tx) => recalculateStandings(tx, id));
  }
  return tournaments.length;
}
