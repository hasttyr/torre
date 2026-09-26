import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // dist/ holds the compiled copies of the tests after `npm run build`:
    // running them too would duplicate every test against stale code.
    exclude: [...configDefaults.exclude, "dist/**"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
