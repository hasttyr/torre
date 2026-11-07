import { defineConfig, devices } from "@playwright/test";

// The browser suites: the production build, served by `vite preview` with
// vercel.json's headers (the real CSP), talking to the real API on a
// disposable database the backend seeds before each run (e2e/globalSetup.ts).
// The API sits behind the app's own origin (/api), as Vercel serves it.
//
// One project per kind of test (docs/plan-de-pruebas.md), always picked with
// --project: a bare `playwright test` would also run the other browsers.
//   chromium   system: the functional flows (e2e/*.spec.ts)
//   smoke      the few checks that say a build is worth testing further
//   usability  accessibility (axe, WCAG 2.1 AA), keyboard use, small screens
//   security   headers, sessions, permissions and hostile input, from outside
//   recovery   the app getting back on its feet when the API drops out
//   firefox, webkit, mobile-chrome, mobile-safari   compatibility: smoke and
//              the read-only flows in the other engines and on phones

const APP = "http://localhost:4173";
const API = "http://localhost:4100";

const SUITES = /[\\/](smoke|usability|security|recovery)[\\/]/;
// Flows that change nothing a later project would trip over: safe to repeat per browser.
const COMPATIBILITY = /([\\/]smoke[\\/].*|[\\/](publicTournaments|session))\.spec\.ts$/;

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
  projects: [
    { name: "chromium", testIgnore: SUITES, use: { ...devices["Desktop Chrome"] } },
    { name: "smoke", testMatch: /[\\/]smoke[\\/].*\.spec\.ts$/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "usability",
      testMatch: /[\\/]usability[\\/].*\.spec\.ts$/,
      // Pages measured at rest: an element halfway through its entrance animation isn't its real color yet.
      use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" },
    },
    { name: "security", testMatch: /[\\/]security[\\/].*\.spec\.ts$/, use: { ...devices["Desktop Chrome"] } },
    { name: "recovery", testMatch: /[\\/]recovery[\\/].*\.spec\.ts$/, use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", testMatch: COMPATIBILITY, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testMatch: COMPATIBILITY, use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", testMatch: COMPATIBILITY, use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", testMatch: COMPATIBILITY, use: { ...devices["iPhone 14"] } },
  ],
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
