import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import VueI18nPlugin from "@intlify/unplugin-vue-i18n/vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/**
 * The security headers vercel.json sends with every page (the CSP among
 * them), so `vite preview` serves the build as production does and the E2E
 * suite runs under the real policy.
 */
function productionHeaders(): Record<string, string> {
  const vercel = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf-8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const everyPage = vercel.headers.find((rule) => rule.source === "/(.*)")?.headers ?? [];
  return Object.fromEntries(everyPage.map(({ key, value }) => [key, value]));
}

// E2E: the API behind the app's own origin, as Vercel serves it (vercel.json
// rewrites /api), and the socket too, so the suite needs no other origin.
const apiTarget = process.env.PREVIEW_API_TARGET;

// https://vite.dev/config/
export default defineConfig({
  // Development: the API on the app's own origin too (/api), as in
  // production, so the session cookie is first-party.
  server: {
    proxy: { "/api": process.env.DEV_API_TARGET ?? "http://localhost:4000" },
  },
  preview: {
    headers: productionHeaders(),
    proxy: apiTarget ? { "/api": apiTarget, "/socket.io": { target: apiTarget, ws: true } } : undefined,
  },
  resolve: {
    alias: {
      // The API contract (catalogs, error codes, response types) is the
      // backend's: the build reads it from the repository's backend folder.
      "@contracts": fileURLToPath(new URL("../backend/src/contracts/index.ts", import.meta.url)),
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    // Compiles the locale files into render functions at build time, so the
    // app ships vue-i18n's runtime without its message compiler (smaller,
    // and nothing to compile on the first render).
    VueI18nPlugin({
      include: [fileURLToPath(new URL("./src/i18n/locales/**", import.meta.url))],
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Vue and its plugins load on every page, together: one file
          // instead of five saves startup round trips. Only libraries the
          // entry needs belong here — anything else would load everywhere.
          groups: [{ name: "vue", test: /node_modules[\\/](@vue|vue|vue-router|pinia|vue-i18n|@intlify)[\\/]/ }],
        },
      },
    },
  },
});
