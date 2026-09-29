import { defineConfig, devices } from "@playwright/test";

// The browser (E2E) suite: the production build, served by `vite preview`
// with vercel.json's headers (the real CSP), talking to the real API on a
// disposable database the backend seeds before each run (e2e/globalSetup.ts).
// The API sits behind the app's own origin (/api), as Vercel serves it.

const APP = "http://localhost:4173";
const API = "http://localhost:4100";

export default defineConfig({
  testDir: "e2e",
  // One database for the whole run: the flows go one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/globalSetup.ts",
  use: {
    baseURL: APP,
    locale: "es-CO",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run e2e:server",
      cwd: "../backend",
      url: `${API}/api/health`,
      env: { PORT: "4100", CORS_ORIGIN: APP, APP_URL: APP },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run build && npm run preview -- --port 4173 --strictPort",
      url: APP,
      env: { VITE_SOCKET_URL: APP, PREVIEW_API_TARGET: API },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
