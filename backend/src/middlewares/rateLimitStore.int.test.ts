import type { Options } from "express-rate-limit";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { startServer } from "../server";
import { resetDatabase } from "../testing/testDatabase";
import { PostgresRateLimitStore } from "./rateLimitStore";

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A store for one limiter (`prefix`) with a `windowMs` window, as a limiter sets it up. */
function storeFor(prefix: string, windowMs = 60_000): PostgresRateLimitStore {
  const store = new PostgresRateLimitStore(prisma, prefix);
  store.init({ windowMs } as Options);
  return store;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("PostgresRateLimitStore", () => {
  it("counts each client's hits in the window, and says when the window ends", async () => {
    const store = storeFor("login:");
    const before = Date.now();

    await store.increment("1.2.3.4|ana@uni.edu");
    const second = await store.increment("1.2.3.4|ana@uni.edu");

    expect(second.totalHits).toBe(2);
    expect(second.resetTime!.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(second.resetTime!.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    expect((await store.increment("5.6.7.8|ana@uni.edu")).totalHits).toBe(1);
  });

  it("starts a new count once the window is over", async () => {
    const store = storeFor("login:", 200);
    await store.increment("1.2.3.4");
    await store.increment("1.2.3.4");

    await pause(250);

    expect((await store.increment("1.2.3.4")).totalHits).toBe(1);
  });

  it("shares the counts between API instances, but not between limiters", async () => {
    const instanceA = storeFor("login:");
    const instanceB = storeFor("login:");
    const register = storeFor("register:");

    await instanceA.increment("1.2.3.4");
    expect((await instanceB.increment("1.2.3.4")).totalHits).toBe(2);
    expect((await register.increment("1.2.3.4")).totalHits).toBe(1);
  });

  it("loses no hit when many arrive at once", async () => {
    const store = storeFor("login:");

    const answers = await Promise.all(Array.from({ length: 20 }, () => store.increment("1.2.3.4")));

    expect(answers.map((answer) => answer.totalHits).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("takes a hit back (a successful login), forgets a client on reset, and reads the current count", async () => {
    const store = storeFor("login:");
    await store.increment("1.2.3.4");
    await store.increment("1.2.3.4");

    await store.decrement("1.2.3.4");
    expect(await store.get("1.2.3.4")).toMatchObject({ totalHits: 1 });

    await store.resetKey("1.2.3.4");
    expect(await store.get("1.2.3.4")).toBeUndefined();
  });

  it("clears out counters whose window is over, so the table doesn't keep growing", async () => {
    const store = storeFor("login:", 100);
    await store.increment("1.1.1.1");
    await store.increment("2.2.2.2");

    await pause(150);
    await store.increment("3.3.3.3");

    const rows = await prisma.$queryRaw<{ key: string }[]>`SELECT key FROM rate_limit_counters`;
    expect(rows.map((row) => row.key)).toEqual(["login:3.3.3.3"]);
  });
});

describe("sign-in limits across API instances", () => {
  it("turns away the 11th failed login even when it reaches another instance", async () => {
    const shared = { rateLimitStore: (prefix: string) => new PostgresRateLimitStore(prisma, prefix) };
    const instanceA = createApp(shared);
    const instanceB = createApp(shared);
    const attempt = { email: "ana@uni.edu", password: "wrong-password" };

    for (let i = 0; i < 10; i += 1) {
      await request(instanceA).post("/api/auth/login").send(attempt).expect(401);
    }

    const eleventh = await request(instanceB).post("/api/auth/login").send(attempt);
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.code).toBe("RATE_LIMITED");
  });
});

describe("the running server", () => {
  it("keeps the sign-in counts in the database", async () => {
    const server = await startServer(0);
    try {
      await request(server.httpServer)
        .post("/api/auth/login")
        .send({ email: "ana@uni.edu", password: "wrong" })
        .expect(401);

      const rows = await prisma.$queryRaw<{ key: string; hits: number }[]>`SELECT key, hits FROM rate_limit_counters`;
      expect(rows).toEqual(
        expect.arrayContaining([
          { key: expect.stringMatching(/^login:.*\|ana@uni\.edu$/), hits: 1 },
          { key: expect.stringMatching(/^login-address:/), hits: 1 },
        ]),
      );
    } finally {
      await server.stop();
    }
  });
});
