import { configDefaults, defineConfig } from "vitest/config";

// Two suites: `unit` (no database: Prisma is mocked) and `integration`
// (real PostgreSQL, *.int.test.ts). Coverage runs both and counts them together.
export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**", "src/generated/**"],
      // The current levels, so coverage can only go up (B-T1). Raise them as it does.
      thresholds: { statements: 96, branches: 90, functions: 95, lines: 96 },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          setupFiles: ["./vitest.setup.ts"],
          exclude: [...configDefaults.exclude, "src/**/*.int.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          // Recreates nothing: migrates the *_test database and each test empties its tables.
          globalSetup: ["./src/testing/integrationGlobalSetup.ts"],
          setupFiles: ["./src/testing/integrationSetup.ts"],
          // One database for the whole suite: files take turns.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
