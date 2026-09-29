import { readEnvFile } from "../config/localEnvFile";
import { resolveTestDatabaseUrl } from "./testDatabaseUrl";

// Runs in each integration worker before any test file imports the app, so
// config/env.ts and config/prisma.ts pick up the test database and a secret
// of the suite's own. Import nothing here that loads config/env.ts (such as
// testDatabase.ts): it reads the environment once, on first import, and would
// keep the development database. resetDatabase refuses it anyway.
process.env.DATABASE_URL = resolveTestDatabaseUrl({ ...readEnvFile(), ...process.env });
process.env.JWT_SECRET = "integration-test-secret";
