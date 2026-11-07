import { execSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { readEnvFile } from "../config/localEnvFile";
import { PrismaClient } from "../generated/prisma/client";
import { APP_ORIGIN, Checks, isHealthy, signIn, startApi } from "./suiteApi";
import { resolveE2eDatabaseUrl } from "./testDatabaseUrl";

// Installation and uninstallation: what a new deploy goes through
// (docs/runbooks/despliegue.md), from nothing. On a database of its own,
// created and dropped here, on the same PostgreSQL as the E2E one:
//
//   npm run test:installation
//
// 1. an empty database gets every migration, in order, from the first;
// 2. `bootstrap` creates the roles, the dashboards and the first
//    administrator (the seed never runs outside development);
// 3. the API starts on it and the administrator can sign in;
// 4. running both again changes nothing (a redeploy);
// 5. uninstalling drops the database, and nothing is left behind.

const PORT = 4400;
const ADMIN = {
  ADMIN_NAME: "Administración Instalación",
  ADMIN_EMAIL: "admin@install.test",
  ADMIN_PASSWORD: "Install-2026!",
};

/** A client for one database, on the same server as `url`. */
function clientFor(url: URL, database: string): PrismaClient {
  const target = new URL(url);
  target.pathname = `/${database}`;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: target.toString() }) });
}

function run(command: string, databaseUrl: string, extra: Record<string, string> = {}): string {
  return execSync(command, {
    env: { ...readEnvFile(), ...process.env, DATABASE_URL: databaseUrl, ...extra },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function main(): Promise<void> {
  const e2e = new URL(resolveE2eDatabaseUrl({ ...readEnvFile(), ...process.env }));
  // Like every suite database, its name ends in _test.
  const name = "torre_installation_test";
  const install = new URL(e2e);
  install.pathname = `/${name}`;
  const databaseUrl = install.toString();
  const server = clientFor(e2e, "postgres");
  const checks = new Checks();

  try {
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    console.log(`\nInstalling on a new, empty database (${name})`);

    const migrated = run("npx prisma migrate deploy", databaseUrl);
    const applied = migrated.match(/(\d+) migrations? found/)?.[1];
    checks.check(
      /applied|No pending/i.test(migrated),
      "every migration applies to an empty database",
      `${applied} migrations`,
    );
    const status = run("npx prisma migrate status", databaseUrl);
    checks.check(/up to date/i.test(status), "the schema ends up exactly at the latest migration");

    const bootstrapped = run("npx tsx src/scripts/bootstrap.ts", databaseUrl, ADMIN);
    checks.check(/administrator .* created/.test(bootstrapped), "bootstrap creates the first administrator");

    const api = await startApi({ port: PORT, databaseUrl });
    try {
      checks.check(await isHealthy(api.url), "the API starts on the new database");
      const rooms = (await (await fetch(`${api.url}/api/tournaments/public/rooms`)).json()) as unknown[];
      checks.check(Array.isArray(rooms) && rooms.length === 0, "a new installation has no data of anyone's");
      const cookie = await signIn(api.url, ADMIN.ADMIN_EMAIL, ADMIN.ADMIN_PASSWORD);
      const me = (await (await fetch(`${api.url}/api/users/me`, { headers: { Cookie: cookie } })).json()) as {
        role: string;
      };
      checks.check(me.role === "ADMINISTRATOR", "the administrator signs in, with the administrator role");
      const created = await fetch(`${api.url}/api/clubs`, {
        method: "POST",
        headers: { Cookie: cookie, Origin: APP_ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Club de instalación" }),
      });
      checks.check(created.status === 201, "and can start working (a club is created)", `${created.status}`);
    } finally {
      await api.crash();
    }

    console.log("\nDeploying again over the installed database");
    checks.check(/No pending/i.test(run("npx prisma migrate deploy", databaseUrl)), "migrations: nothing pending");
    checks.check(
      /already exists, so none was created/.test(run("npx tsx src/scripts/bootstrap.ts", databaseUrl, ADMIN)),
      "bootstrap again creates no second administrator",
    );

    console.log("\nUninstalling");
    await server.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    const left = await server.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_database WHERE datname = ${name}`;
    checks.check(Number(left[0]!.count) === 0, "dropping the database removes the installation: nothing is left");
  } finally {
    await server.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await server.$disconnect();
  }
  checks.finish("Installation");
}

main().catch((error: Error) => {
  console.error(`The installation suite failed to run: ${error.message}`);
  process.exitCode = 1;
});
