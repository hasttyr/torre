import { execSync } from "node:child_process";

import { readEnvFile } from "../config/localEnvFile";
import { resolveTestDatabaseUrl } from "./testDatabaseUrl";

/**
 * Runs once before the integration suite: brings the test database up to the
 * latest migration (creating it the first time). Each test then starts from
 * empty tables (resetDatabase), so nothing here needs to drop anything.
 *
 * @remarks
 * Reads .env without loading it into this process: the unit suite's workers
 * inherit this process's environment and must not see the real secrets.
 */
export default function setup(): void {
  const fromFile = readEnvFile();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl({ ...fromFile, ...process.env }) },
    stdio: "ignore",
  });
}
