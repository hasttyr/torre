import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    coverage: {
      include: ["src/**/*.{ts,vue}"],
      exclude: ["src/**/*.test.ts", "src/test-support/**"],
    },
  },
});
