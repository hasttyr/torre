import { readEnvFile } from "../config/localEnvFile";
import { resolveE2eDatabaseUrl } from "./testDatabaseUrl";

// The API the browser (E2E) suite talks to: the same server, on the E2E
// database. The environment is set before the app is imported, because
// config/env.ts reads it once, on first import.
process.env.DATABASE_URL = resolveE2eDatabaseUrl({ ...readEnvFile(), ...process.env });
process.env.PORT ??= "4100";

import("../server")
  .then(({ startServer }) => startServer(Number(process.env.PORT)))
  .catch((error: Error) => {
    console.error(`The E2E server didn't start: ${error.message}`);
    process.exitCode = 1;
  });
