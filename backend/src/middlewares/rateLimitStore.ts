import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";

import type { PrismaClient } from "../generated/prisma/client";

interface CounterRow {
  hits: number;
  reset_at: Date;
}

const info = (row: CounterRow): ClientRateLimitInfo => ({ totalHits: row.hits, resetTime: row.reset_at });

/**
 * express-rate-limit's counters in PostgreSQL (`rate_limit_counters`): shared
 * by every API instance, and kept when one restarts, as Render's free plan
 * does after a while without traffic. One store per limiter: `prefix` keeps
 * each limiter's counts apart.
 */
export class PostgresRateLimitStore implements Store {
  readonly localKeys = false;
  private windowMs = 60_000;
  private lastCleanup = 0;

  constructor(
    private readonly prisma: PrismaClient,
    readonly prefix: string,
  ) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const [row] = await this.prisma.$queryRaw<CounterRow[]>`
      SELECT hits, reset_at FROM rate_limit_counters WHERE key = ${this.prefix + key} AND reset_at > ${new Date()}`;
    return row && info(row);
  }

  /** One more hit, in a single statement: concurrent requests never lose a count. */
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    await this.clearExpired(now);
    const resetAt = new Date(now.getTime() + this.windowMs);
    const [row] = await this.prisma.$queryRaw<CounterRow[]>`
      INSERT INTO rate_limit_counters (key, hits, reset_at) VALUES (${this.prefix + key}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limit_counters.reset_at <= ${now} THEN 1 ELSE rate_limit_counters.hits + 1 END,
        reset_at = CASE WHEN rate_limit_counters.reset_at <= ${now}
          THEN EXCLUDED.reset_at ELSE rate_limit_counters.reset_at END
      RETURNING hits, reset_at`;
    return info(row!);
  }

  /** Takes a hit back (a request the limiter doesn't count, like a successful login). */
  async decrement(key: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE rate_limit_counters SET hits = hits - 1
      WHERE key = ${this.prefix + key} AND hits > 0 AND reset_at > ${new Date()}`;
  }

  async resetKey(key: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM rate_limit_counters WHERE key = ${this.prefix + key}`;
  }

  /** At most once a window, per instance: every counter whose window is over, whatever its limiter. */
  private async clearExpired(now: Date): Promise<void> {
    if (now.getTime() - this.lastCleanup < this.windowMs) return;
    this.lastCleanup = now.getTime();
    await this.prisma.$executeRaw`DELETE FROM rate_limit_counters WHERE reset_at <= ${now}`;
  }
}
