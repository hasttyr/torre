import { defineConfig } from "prisma/config";

import { loadLocalEnvFile } from "./src/config/localEnvFile";

// The Prisma CLI reads DATABASE_URL from the environment, or from the local .env.
loadLocalEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  // Only the commands that reach the database need it: `prisma generate` runs without one (CI does).
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
