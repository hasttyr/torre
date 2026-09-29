import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  // Same as vite.config.ts: the API contract lives in the backend folder.
  resolve: {
    alias: { "@contracts": fileURLToPath(new URL("../backend/src/contracts/index.ts", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // e2e/ is the browser suite, run by Playwright (npm run test:e2e).
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      include: ["src/**/*.{ts,vue}"],
      exclude: [
        "src/**/*.test.ts",
        "src/test-support/**",
        // Bootstrap and full page loads: they only run in a real browser.
        "src/main.ts",
        "src/lib/pageLoad.ts",
        // The landing page's decorative mock-ups: pictures of the app, no behavior.
        "src/components/home/*Mock.vue",
        "src/components/home/MockWindow.vue",
      ],
      // The current levels, so coverage can only go up (F-T1). Raise them as it does.
      thresholds: { statements: 93, branches: 88, functions: 91, lines: 94 },
    },
  },
});
