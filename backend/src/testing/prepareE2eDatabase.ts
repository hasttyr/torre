import { execSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { readEnvFile } from "../config/localEnvFile";
import { PrismaClient } from "../generated/prisma/client";
import { resetDatabase } from "./testDatabase";
import { resolveE2eDatabaseUrl } from "./testDatabaseUrl";

// Prepares the browser (E2E) suite's database before a run: migrated, emptied
// and seeded with the demo accounts and tournaments (prisma/seed.ts). Like
// every suite database, only ever one whose name ends in _test.
async function main(): Promise<void> {
  const url = resolveE2eDatabaseUrl({ ...readEnvFile(), ...process.env });
  const env = { ...process.env, DATABASE_URL: url };

  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await resetDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}

main().catch((error: Error) => {
  console.error(`Preparing the E2E database failed: ${error.message}`);
  process.exitCode = 1;
});
