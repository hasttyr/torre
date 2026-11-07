import { execSync, fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";

import { readEnvFile } from "../config/localEnvFile";
import { resolveE2eDatabaseUrl } from "./testDatabaseUrl";

// What the load, recovery and installation suites share: the API in a
// process of their own (suiteServer.ts), the E2E database they run on, and
// a few helpers for talking to it the way the browser does.

/** The origin the suites' API lets in, and the one their changes say they come from (anti-CSRF). */
export const APP_ORIGIN = "http://localhost:4173";

/** The seed's password for every demo account. */
export const SEED_PASSWORD = "Test1234";

export interface SuiteApi {
  url: string;
  child: ChildProcess;
  /** The API process's memory use, after a garbage collection. */
  memory(): Promise<NodeJS.MemoryUsage>;
  /** Kills the process outright, as a crash or a power cut would: no graceful shutdown. */
  crash(): Promise<void>;
}

interface StartOptions {
  port: number;
  databaseUrl: string;
  /** Extra environment for the API (TRUST_PROXY…). */
  env?: Record<string, string>;
}

/** The E2E database (DATABASE_URL's with "_e2e_test"), migrated, emptied and seeded with the demo data. */
export function prepareE2eDatabase(): string {
  execSync("npm run e2e:prepare", { stdio: "inherit" });
  return resolveE2eDatabaseUrl({ ...readEnvFile(), ...process.env });
}

/** Starts the API in a process of its own and waits until it answers. */
export async function startApi({ port, databaseUrl, env = {} }: StartOptions): Promise<SuiteApi> {
  const child = fork(join(__dirname, "suiteServer.ts"), [], {
    execArgv: ["--import", "tsx", "--expose-gc"],
    env: {
      ...readEnvFile(),
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      CORS_ORIGIN: APP_ORIGIN,
      APP_URL: APP_ORIGIN,
      ...env,
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const [first] = await Promise.race([once(child, "message"), once(child, "exit")]);
  if (first !== "listening") throw new Error(`The API on port ${port} didn't start (exit code ${String(first)})`);

  return {
    url: `http://localhost:${port}`,
    child,
    async memory() {
      child.send("memory");
      const [reply] = (await once(child, "message")) as [{ memory: NodeJS.MemoryUsage }];
      return reply.memory;
    },
    async crash() {
      if (child.exitCode !== null) return;
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    },
  };
}

/** The session cookie for one of the seed's accounts, as a Cookie header. */
export async function signIn(url: string, email: string, password = SEED_PASSWORD): Promise<string> {
  const answer = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (answer.status !== 200) throw new Error(`Signing in as ${email} answered ${answer.status}`);
  const cookie = answer.headers.getSetCookie().find((header) => header.startsWith("torre_session="));
  if (!cookie) throw new Error(`Signing in as ${email} set no session cookie`);
  return cookie.split(";")[0]!;
}

/** Whether the API answers its health check right now. */
export async function isHealthy(url: string): Promise<boolean> {
  try {
    const answer = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2_000) });
    return answer.status === 200;
  } catch {
    return false;
  }
}

/** The p-th percentile (0–100) of a list of numbers. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

/** One check of a suite: printed as it runs, and counted for the exit code. */
export class Checks {
  private failed = 0;

  check(passed: boolean, description: string, detail = ""): void {
    console.log(`  ${passed ? "✓" : "✘"} ${description}${detail ? `  (${detail})` : ""}`);
    if (!passed) this.failed += 1;
  }

  /** Prints the outcome and sets the exit code: 1 when any check failed. */
  finish(suite: string): void {
    console.log(this.failed === 0 ? `\n${suite}: all checks passed` : `\n${suite}: ${this.failed} check(s) failed`);
    process.exitCode = this.failed === 0 ? 0 : 1;
  }
}
