// Seed-scale benchmark (B-P1): fills the integration suite's database (it's
// emptied by every run anyway; never another one, see resetDatabase) with
// about ten times a university's data, and times the queries that grow with
// it. Measure here before optimizing, and again after:
//
//   npm run benchmark
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { loadLocalEnvFile } from "../config/localEnvFile";
import type { Prisma } from "../generated/prisma/client";
import { resolveTestDatabaseUrl } from "./testDatabaseUrl";

loadLocalEnvFile();
process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env);

const PLAYERS = 1000;
const TOURNAMENTS = 100;
const PER_TOURNAMENT = 40;
const ROUNDS = 7;
const FIRST = ["Ana", "Luis", "María", "Juan", "Laura", "Carlos", "Sofía", "Andrés", "Valentina", "Diego"];
const LAST = ["Torres", "Gómez", "Rodríguez", "Martínez", "López", "Díaz", "Pérez", "Ruiz", "Moreno", "Castro"];

const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
function sample<T>(list: T[], count: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}

async function median(label: string, run: () => Promise<unknown>, runs = 5): Promise<void> {
  await run();
  const times: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  console.log(`${label.padEnd(44)} ${times[Math.floor(runs / 2)]!.toFixed(1).padStart(8)} ms`);
}

async function main(): Promise<void> {
  const { prisma } = await import("../config/prisma");
  const { resetDatabase } = await import("./testDatabase");
  const { loadPlayersOverview, loadTopPlayers } = await import("../services/dashboard/widgets/directoryWidgets");
  const { searchPlayers } = await import("../services/players.service");
  const { listUsers } = await import("../services/users.service");
  const { generateRound, discardRound } = await import("../services/rounds.service");

  await resetDatabase(prisma);
  const roleId = async (name: string) => (await prisma.role.findUniqueOrThrow({ where: { name } })).id;
  const playerRole = await roleId("PLAYER");
  const organizerId = randomUUID();
  await prisma.user.create({
    data: { id: organizerId, name: "Org", email: "org@b.test", passwordHash: "x", roleId: await roleId("ORGANIZER") },
  });

  const users = Array.from({ length: PLAYERS }, (_, i) => ({
    id: randomUUID(),
    name: `${pick(FIRST)} ${pick(LAST)} ${pick(LAST)}`,
    email: `p${i}@b.test`,
    passwordHash: "x",
    roleId: playerRole,
  }));
  await prisma.user.createMany({ data: users });
  const players = users.map((user, i) => ({
    id: randomUUID(),
    userId: user.id,
    universityCode: `U${String(i).padStart(5, "0")}`,
    program: "Ingeniería",
    semester: 5,
  }));
  await prisma.player.createMany({ data: players });
  const playerIds = players.map((player) => player.id);

  const tournaments: Prisma.TournamentCreateManyInput[] = [];
  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const rounds: Prisma.RoundCreateManyInput[] = [];
  const matches: Prisma.MatchCreateManyInput[] = [];
  const results: Prisma.ResultCreateManyInput[] = [];
  const standings: Prisma.StandingCreateManyInput[] = [];
  for (let t = 0; t < TOURNAMENTS; t += 1) {
    const id = randomUUID();
    tournaments.push({
      id,
      name: `Torneo ${t}`,
      startDate: new Date(2020, 0, 1 + t),
      endDate: new Date(2020, 0, 2 + t),
      status: "FINISHED",
      roundsCount: ROUNDS,
      organizerId,
    });
    const entrants = sample(playerIds, PER_TOURNAMENT);
    entrants.forEach((playerId, index) => {
      enrollments.push({ tournamentId: id, playerId, pairingNumber: index + 1 });
      standings.push({ tournamentId: id, playerId, score: PER_TOURNAMENT - index, rank: index + 1 });
    });
    for (let r = 1; r <= ROUNDS; r += 1) {
      const roundId = randomUUID();
      rounds.push({ id: roundId, tournamentId: id, number: r, status: "STANDINGS_UPDATED" });
      const order = sample(entrants, PER_TOURNAMENT);
      for (let b = 0; b < PER_TOURNAMENT / 2; b += 1) {
        const matchId = randomUUID();
        matches.push({ id: matchId, roundId, board: b + 1, whiteId: order[2 * b], blackId: order[2 * b + 1] });
        results.push({ matchId, value: pick(["1-0", "0-1", "1/2-1/2"]) });
      }
    }
  }
  await prisma.tournament.createMany({ data: tournaments });
  await prisma.enrollment.createMany({ data: enrollments });
  await prisma.round.createMany({ data: rounds });
  await prisma.match.createMany({ data: matches });
  await prisma.result.createMany({ data: results });
  await prisma.standing.createMany({ data: standings });
  await prisma.$executeRaw`ANALYZE`;
  console.log(
    `${PLAYERS} players, ${TOURNAMENTS} tournaments, ${matches.length} games, ${standings.length} standings\n`,
  );

  const admin = { id: organizerId, role: "ADMINISTRATOR" };
  // A timing of a query that finds nothing means nothing: this one once
  // matched no game at all, and ran fast.
  const tallied = (await loadPlayersOverview(prisma, admin)).reduce((sum, row) => sum + row.games, 0);
  if (tallied !== 2 * matches.length) {
    throw new Error(`PLAYERS_OVERVIEW tallied ${tallied} player-games, expected ${2 * matches.length}`);
  }
  await median("PLAYERS_OVERVIEW (everyone)", () => loadPlayersOverview(prisma, admin));
  await median("TOP_PLAYERS", () => loadTopPlayers(prisma));
  await median("GET /users (listUsers)", () => listUsers(prisma));
  await median('search "torres"', () => searchPlayers(prisma, "torres", admin));
  await median('search "U0099"', () => searchPlayers(prisma, "U0099", admin));

  const big = await prisma.tournament.create({
    data: {
      name: "Grande",
      startDate: new Date(),
      endDate: new Date(),
      status: "REGISTRATION_CLOSED",
      roundsCount: 7,
      organizerId,
      enrollments: { create: sample(playerIds, 100).map((playerId) => ({ playerId })) },
    },
  });
  const organizer = { id: organizerId, role: "ORGANIZER" };
  await median("generate round 1 (100 players, then discard)", async () => {
    const round = await generateRound(prisma, big.id, organizer);
    await discardRound(prisma, round.id, organizer);
  });

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
