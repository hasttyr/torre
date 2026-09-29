import type { Prisma, PrismaClient, TournamentStatus } from "../generated/prisma/client";

import { hashPassword } from "../services/password";
import { ROLES, type Role as RoleName } from "../contracts/catalogs";
import { signSessionToken } from "../services/sessionToken";
import { TEST_SUFFIX } from "./testDatabaseUrl";

// Shared by the integration suite (*.int.test.ts): a real PostgreSQL
// database, migrated from scratch before the run and emptied before each test.

/**
 * Empties every table (keeping the migration history) and recreates the role catalog.
 *
 * @throws {Error} unless the database the client is connected to is named
 * "…_test": checked on the connection itself, not on a URL, so no
 * configuration mistake can point this at real data.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!name.endsWith(TEST_SUFFIX)) {
    throw new Error(`Refusing to empty "${name}": the integration suite only runs against a database ending in _test`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  await prisma.role.createMany({ data: ROLES.map((name) => ({ name })) });
}

export const TEST_PASSWORD = "password123";

// Hashing is deliberately slow: done once per run, shared by every test user.
let passwordHash: Promise<string> | undefined;

export interface TestUser {
  id: string;
  playerId: string | null;
  email: string;
  token: string;
}

let userCount = 0;

/** Creates an active user with TEST_PASSWORD (and a player profile for PLAYER), plus a session token for them. */
export async function createUser(
  prisma: PrismaClient,
  role: RoleName,
  overrides: { name?: string; email?: string; program?: string; semester?: number } = {},
): Promise<TestUser> {
  userCount += 1;
  passwordHash ??= hashPassword(TEST_PASSWORD);
  const email = overrides.email ?? `${role.toLowerCase()}${userCount}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `${role} ${userCount}`,
      email,
      passwordHash: await passwordHash,
      role: { connect: { name: role } },
      dataPolicyAccepted: true,
      ...(role === "PLAYER"
        ? {
            player: {
              create: {
                universityCode: `U${userCount}`,
                program: overrides.program ?? "Ingeniería de Sistemas",
                semester: overrides.semester ?? 5,
              },
            },
          }
        : {}),
    },
    include: { player: true },
  });
  return { id: user.id, playerId: user.player?.id ?? null, email, token: signSessionToken({ id: user.id, role }) };
}

/** The Authorization header for a user's session, for supertest's `.set()`. */
export function bearer(user: Pick<TestUser, "token">): { Authorization: string } {
  return { Authorization: `Bearer ${user.token}` };
}

/** A tournament in `status`, organized by `organizer`, with `players` enrolled. */
export async function createTournament(
  prisma: PrismaClient,
  organizer: TestUser,
  options: { status: TournamentStatus; roundsCount?: number; players?: TestUser[] },
) {
  return prisma.tournament.create({
    data: {
      name: "Copa Otoño",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-02"),
      status: options.status,
      roundsCount: options.roundsCount ?? null,
      organizerId: organizer.id,
      enrollments: { create: (options.players ?? []).map((player) => ({ playerId: player.playerId! })) },
    },
  });
}

/**
 * Runs `whileLocked` while holding the tournament's row lock, then commits
 * `thenChange` in the same transaction: a change that lands while a request
 * is half-way, for race tests. `whileLocked` starts the request and returns
 * it unawaited; it's given time to reach the database before the change.
 */
export async function raceWithChange<T>(
  prisma: PrismaClient,
  tournamentId: string,
  whileLocked: () => Promise<T>,
  thenChange: (tx: Prisma.TransactionClient) => Promise<unknown>,
): Promise<T> {
  let inFlight!: Promise<T>;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId} FOR UPDATE`;
    inFlight = whileLocked();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await thenChange(tx);
  });
  return inFlight;
}
