import { createServer, Socket, type Server } from "node:net";

import { APP_ORIGIN, Checks, isHealthy, prepareE2eDatabase, signIn, startApi, type SuiteApi } from "./suiteApi";

// Recovery: the API crashing (a power cut, Render killing the instance) and
// the database dropping out from under it, on the E2E database.
//
//   npm run test:recovery
//
// The database is reached through a TCP proxy this script runs, so it can
// cut the connection and bring it back without touching PostgreSQL itself.
// The browser's side (the API or the network gone for a while) is
// frontend/e2e/recovery/recovery.spec.ts.

const PORT = 4300;
const RESTART_LIMIT_MS = 30_000;
const RECONNECT_LIMIT_MS = 15_000;

/** A TCP proxy to PostgreSQL that can drop every connection and refuse new ones, then let them through again. */
class DatabaseLink {
  private server: Server | undefined;
  private readonly sockets = new Set<Socket>();

  constructor(
    private readonly target: { host: string; port: number },
    readonly port: number,
  ) {}

  async up(): Promise<void> {
    this.server = createServer((client) => {
      const upstream = new Socket();
      upstream.connect(this.target.port, this.target.host);
      for (const socket of [client, upstream]) {
        this.sockets.add(socket);
        socket.on("close", () => this.sockets.delete(socket));
        socket.on("error", () => socket.destroy());
      }
      client.pipe(upstream).pipe(client);
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => client.destroy());
    });
    await new Promise<void>((resolve) => this.server!.listen(this.port, "127.0.0.1", resolve));
  }

  /** The database "goes away": open connections are cut and new ones refused. */
  async down(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.server = undefined;
  }
}

/** How long until `probe` holds, polling; Infinity if it doesn't within `limit` ms. */
async function timeUntil(probe: () => Promise<boolean>, limit: number): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < limit) {
    if (await probe()) return Date.now() - start;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return Infinity;
}

async function statusOf(url: string, cookie: string): Promise<number> {
  try {
    const answer = await fetch(`${url}/api/tournaments/live`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(8_000),
    });
    return answer.status;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const real = new URL(prepareE2eDatabase());
  const link = new DatabaseLink({ host: real.hostname, port: Number(real.port || 5432) }, PORT + 1);
  await link.up();
  const proxied = new URL(real);
  proxied.hostname = "127.0.0.1";
  proxied.port = String(link.port);
  const databaseUrl = proxied.toString();

  const checks = new Checks();
  let api: SuiteApi = await startApi({ port: PORT, databaseUrl });
  try {
    console.log("\nA crash in the middle of the work");
    const cookie = await signIn(api.url, "organizer@test.com");
    const change = await fetch(`${api.url}/api/users/me/notifications`, {
      method: "PUT",
      headers: { Cookie: cookie, Origin: APP_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ roundPublished: false }),
    });
    checks.check(change.status === 200, "a change is saved before the crash", `${change.status}`);

    await api.crash();
    checks.check(!(await isHealthy(api.url)), "the API is really down (killed, no graceful shutdown)");

    const restarted = Date.now();
    api = await startApi({ port: PORT, databaseUrl });
    const recoveryMs = Date.now() - restarted;
    checks.check(recoveryMs < RESTART_LIMIT_MS, `it's back within ${RESTART_LIMIT_MS / 1000} s`, `${recoveryMs} ms`);

    const me = await fetch(`${api.url}/api/users/me`, { headers: { Cookie: cookie } });
    checks.check(me.status === 200, "the session from before the crash still works: nobody signs in again");
    const settings = (await (
      await fetch(`${api.url}/api/users/me/notifications`, { headers: { Cookie: cookie } })
    ).json()) as { roundPublished: boolean };
    checks.check(settings.roundPublished === false, "what was saved before the crash is still there (nothing lost)");

    console.log("\nThe database drops out, and comes back");
    checks.check((await statusOf(api.url, cookie)) === 200, "with the database up, a read works");
    await link.down();
    const whileDown = await statusOf(api.url, cookie);
    checks.check(
      whileDown >= 500 || whileDown === 0,
      "without the database, a read fails with an error, not wrong data",
      `${whileDown}`,
    );
    checks.check(api.child.exitCode === null && (await isHealthy(api.url)), "the API process stays up meanwhile");

    await link.up();
    const reconnectMs = await timeUntil(async () => (await statusOf(api.url, cookie)) === 200, RECONNECT_LIMIT_MS);
    checks.check(
      reconnectMs < RECONNECT_LIMIT_MS,
      `once the database is back, the API reconnects on its own within ${RECONNECT_LIMIT_MS / 1000} s`,
      Number.isFinite(reconnectMs) ? `${reconnectMs} ms` : "never",
    );

    // Leave the account as the seed had it.
    await fetch(`${api.url}/api/users/me/notifications`, {
      method: "PUT",
      headers: { Cookie: cookie, Origin: APP_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ roundPublished: true }),
    });
  } finally {
    await api.crash();
    await link.down();
  }
  checks.finish("Recovery");
}

main().catch((error: Error) => {
  console.error(`The recovery suite failed to run: ${error.message}`);
  process.exitCode = 1;
});
