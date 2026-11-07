import { Checks, isHealthy, percentile, prepareE2eDatabase, signIn, startApi, type SuiteApi } from "./suiteApi";

// Performance (RNF03, RNF06), against the real API on the E2E database (the
// seed's demo data: nine tournaments, one in progress). Three modes:
//
//   npm run test:load        the expected load of a tournament day, with its thresholds
//   npm run test:stress      steps up until the API stops keeping up, then checks it recovers
//   npm run test:endurance   a steady load for minutes, watching latency and memory drift
//
// Each virtual user sends one request after another with no pause, so 50 of
// them is far more traffic than 50 people refreshing a page; a university
// tournament has a few dozen. The requests come from a campus' worth of
// addresses (X-Forwarded-For, with TRUST_PROXY=1 as behind Vercel), each well
// under its rate limits: what's measured is the API, not the per-address
// limits, which the security suite checks. A fixed set, not a new address
// per request: the limits keep a counter per address for their window, and
// endless new addresses would only measure those counters piling up.
//
// Thresholds can be tuned without touching the code: LOAD_USERS,
// LOAD_SECONDS, LOAD_P95_MS, ENDURANCE_MINUTES.

const PORT = 4200;
const env = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

interface Sample {
  ms: number;
  status: number; // 0: no answer (connection refused, timeout)
}

interface Target {
  path: string;
  cookie?: string;
}

/** What people do on a tournament day: follow the public room and the standings, open their panel. */
async function targets(url: string): Promise<Target[]> {
  const [organizer, player, arbiter] = await Promise.all([
    signIn(url, "organizer@test.com"),
    signIn(url, "player@test.com"),
    signIn(url, "arbiter@test.com"),
  ]);
  const rooms = (await (await fetch(`${url}/api/tournaments/public/rooms`)).json()) as { id: string; name: string }[];
  const finished = rooms.find((room) => room.name === "Copa Primavera 2026")!.id;
  const live = (await (await fetch(`${url}/api/tournaments/live`, { headers: { Cookie: player } })).json()) as {
    id: string;
  }[];
  const inProgress = live[0]?.id ?? finished;

  return [
    { path: "/api/tournaments/public/rooms" },
    { path: `/api/tournaments/public/${finished}` },
    { path: `/api/tournaments/${inProgress}/standings`, cookie: player },
    { path: `/api/tournaments/${inProgress}/rounds`, cookie: arbiter },
    { path: "/api/tournaments/live", cookie: player },
    { path: "/api/users/me", cookie: player },
    { path: "/api/dashboard", cookie: organizer },
    { path: "/api/tournaments/mine", cookie: organizer },
  ];
}

// Enough that none nears a limit in a 15-minute window at ~1,100 requests a
// second (the public pages' 300 per address is the tightest).
const ADDRESSES = 4_000;
let request = 0;
/** The next client address, round the campus: 10.0.0.1 … 10.0.15.160. */
function nextAddress(): string {
  request = (request % ADDRESSES) + 1;
  return `10.0.${request >> 8}.${request & 255}`;
}

/** `users` virtual users sending requests back to back for `seconds`. */
async function run(url: string, list: Target[], users: number, seconds: number): Promise<Sample[]> {
  const samples: Sample[] = [];
  const end = Date.now() + seconds * 1000;
  let next = 0;
  await Promise.all(
    Array.from({ length: users }, async () => {
      while (Date.now() < end) {
        const target = list[next++ % list.length]!;
        const headers: Record<string, string> = { "X-Forwarded-For": nextAddress() };
        if (target.cookie) headers.Cookie = target.cookie;
        const start = performance.now();
        try {
          const answer = await fetch(`${url}${target.path}`, { headers, signal: AbortSignal.timeout(10_000) });
          await answer.arrayBuffer();
          samples.push({ ms: performance.now() - start, status: answer.status });
        } catch {
          samples.push({ ms: performance.now() - start, status: 0 });
        }
      }
    }),
  );
  return samples;
}

interface Summary {
  requests: number;
  perSecond: number;
  p50: number;
  p95: number;
  p99: number;
  errors: number;
  serverErrors: number;
}

function summarize(samples: Sample[], seconds: number): Summary {
  const ms = samples.map((sample) => sample.ms);
  return {
    requests: samples.length,
    perSecond: Math.round(samples.length / seconds),
    p50: Math.round(percentile(ms, 50)),
    p95: Math.round(percentile(ms, 95)),
    p99: Math.round(percentile(ms, 99)),
    errors: samples.filter((sample) => sample.status < 200 || sample.status >= 300).length,
    serverErrors: samples.filter((sample) => sample.status === 0 || sample.status >= 500).length,
  };
}

function describe(summary: Summary): string {
  return `${summary.requests} req, ${summary.perSecond} req/s, p50 ${summary.p50} ms, p95 ${summary.p95} ms, p99 ${summary.p99} ms, ${summary.errors} errors (${summary.serverErrors} 5xx or no answer)`;
}

async function load(api: SuiteApi, list: Target[], checks: Checks): Promise<void> {
  const users = env("LOAD_USERS", 50);
  const seconds = env("LOAD_SECONDS", 30);
  const p95Limit = env("LOAD_P95_MS", 500);
  console.log(`\nLoad: ${users} virtual users for ${seconds} s`);

  await run(api.url, list, 5, 3); // warm-up: connections, query plans, JIT
  const summary = summarize(await run(api.url, list, users, seconds), seconds);
  console.log(`  ${describe(summary)}`);
  checks.check(summary.errors === 0, "every request answered 2xx", `${summary.errors} did not`);
  checks.check(summary.p95 <= p95Limit, `p95 within ${p95Limit} ms`, `${summary.p95} ms`);
  checks.check(summary.p99 <= p95Limit * 3, `p99 within ${p95Limit * 3} ms`, `${summary.p99} ms`);
  checks.check(summary.perSecond >= 50, "at least 50 requests per second", `${summary.perSecond}/s`);
}

async function stress(api: SuiteApi, list: Target[], checks: Checks): Promise<void> {
  const steps = [25, 50, 100, 200, 400, 800];
  const seconds = 10;
  console.log(`\nStress: ${steps.join(" → ")} virtual users, ${seconds} s each`);

  let breakingPoint: number | undefined;
  for (const users of steps) {
    const summary = summarize(await run(api.url, list, users, seconds), seconds);
    const failing = summary.errors / summary.requests > 0.01 || summary.p95 > 1_000;
    console.log(`  ${String(users).padStart(4)} users: ${describe(summary)}${failing ? "  ← no longer keeps up" : ""}`);
    if (failing && breakingPoint === undefined) breakingPoint = users;
    if (!(await isHealthy(api.url)) || api.child.exitCode !== null) break;
  }
  console.log(
    breakingPoint
      ? `  The API stops keeping up (p95 > 1 s or > 1 % errors) at ${breakingPoint} simultaneous users.`
      : `  The API kept up through ${steps.at(-1)} simultaneous users.`,
  );

  checks.check(api.child.exitCode === null, "the API process survived the stress");
  checks.check(breakingPoint === undefined || breakingPoint >= 100, "it keeps up with at least 100 simultaneous users");
  // Afterwards, a normal load gets normal answers again, without a restart.
  const after = summarize(await run(api.url, list, 10, 5), 5);
  console.log(`  After the stress, 10 users: ${describe(after)}`);
  checks.check(
    after.errors === 0 && after.p95 <= 500,
    "it recovers on its own once the load drops",
    `p95 ${after.p95} ms`,
  );
}

async function endurance(api: SuiteApi, list: Target[], checks: Checks): Promise<void> {
  const minutes = env("ENDURANCE_MINUTES", 5);
  const users = env("LOAD_USERS", 30);
  const window = 30;
  const windows = Math.max(2, Math.round((minutes * 60) / window));
  console.log(`\nEndurance: ${users} virtual users for ${minutes} min, measured every ${window} s`);

  await run(api.url, list, 5, 3);
  const startMemory = await api.memory();
  const results: Summary[] = [];
  for (let index = 0; index < windows; index += 1) {
    const summary = summarize(await run(api.url, list, users, window), window);
    results.push(summary);
    const heap = Math.round((await api.memory()).heapUsed / 1_048_576);
    console.log(`  ${String((index + 1) * window).padStart(4)} s: ${describe(summary)}, heap ${heap} MB`);
  }
  const endMemory = await api.memory();

  const first = results[0]!;
  const last = results.at(-1)!;
  const errors = results.reduce((total, summary) => total + summary.errors, 0);
  const heapGrowth = Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1_048_576);
  checks.check(errors === 0, "no request failed over the whole run", `${errors} failed`);
  checks.check(
    last.p95 <= Math.max(first.p95 * 2, first.p95 + 100),
    "latency doesn't degrade: the last p95 is within twice the first",
    `${first.p95} → ${last.p95} ms`,
  );
  checks.check(heapGrowth < 50, "memory doesn't keep growing: under 50 MB more heap at the end", `${heapGrowth} MB`);
}

const MODES = { load, stress, endurance };

async function main(): Promise<void> {
  const mode = process.argv[2] as keyof typeof MODES;
  if (!(mode in MODES)) throw new Error(`Usage: loadTest.ts ${Object.keys(MODES).join(" | ")}`);

  const api = await startApi({ port: PORT, databaseUrl: prepareE2eDatabase(), env: { TRUST_PROXY: "1" } });
  const checks = new Checks();
  try {
    await MODES[mode](api, await targets(api.url), checks);
  } finally {
    await api.crash();
  }
  checks.finish(`Performance (${mode})`);
}

main().catch((error: Error) => {
  console.error(`The performance suite failed to run: ${error.message}`);
  process.exitCode = 1;
});
