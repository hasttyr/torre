import { createServer, type Server } from "node:http";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { hashPassword } from "../services/password";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    role: { findUnique: vi.fn() },
    passwordResetRequest: { create: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

// Hashing is slow on purpose; these tests make hundreds of attempts. Same
// contract, instant: a password matches the "hash" made from it.
vi.mock("../services/password", () => ({
  hashPassword: async (password: string) => `hash:${password}`,
  comparePassword: async (password: string, hash: string) => hash === `hash:${password}`,
  needsRehash: () => false,
}));

type App = Server;

const servers: Server[] = [];

/**
 * The app on one port for the whole test. These tests send hundreds of
 * requests; handing supertest the bare app would open and close a server for
 * every single one.
 */
function serve(app: ReturnType<typeof createApp>): Server {
  const server = createServer(app).listen(0);
  servers.push(server);
  return server;
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((closed) => server.close(closed));
  }
});

const tryLogin = (app: App, email: string, password = "wrong-password") =>
  request(app).post("/api/auth/login").send({ email, password });

/** Sends `times` requests one after another, returning their statuses. */
async function repeat(times: number, send: (attempt: number) => Promise<{ status: number }>): Promise<number[]> {
  const statuses: number[] = [];
  for (let attempt = 0; attempt < times; attempt++) statuses.push((await send(attempt)).status);
  return statuses;
}

/** Sends `times` logins for `email` that fail (no such user), one after another. */
async function failLogins(app: App, email: string, times: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let attempt = 0; attempt < times; attempt++) statuses.push((await tryLogin(app, email)).status);
  return statuses;
}

describe("login attempts limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  it("turns away an 11th failed login for the same email and address, saying when to retry", async () => {
    const app = serve(createApp());

    expect(await failLogins(app, "ana@example.com", 10)).toEqual(Array(10).fill(401));
    const blocked = await tryLogin(app, "ana@example.com");

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: expect.stringMatching(/Demasiados intentos/),
      code: "RATE_LIMITED",
      params: { minutes: expect.any(Number) },
    });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts per account, so classmates sharing the campus address aren't blocked by someone else's typos", async () => {
    const app = serve(createApp());
    await failLogins(app, "ana@example.com", 10);

    expect((await tryLogin(app, "luis@example.com")).status).toBe(401);
  });

  it("counts an email however it's capitalized or padded", async () => {
    const app = serve(createApp());
    await failLogins(app, "ana@example.com", 10);

    expect((await tryLogin(app, "  ANA@Example.com ")).status).toBe(429);
  });

  it("ignores X-Forwarded-For without TRUST_PROXY set, so it can't be used to dodge the limit", async () => {
    const app = serve(createApp());
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      statuses.push(
        (
          await request(app)
            .post("/api/auth/login")
            .set("X-Forwarded-For", "1.1.1.1")
            .send({ email: "ana@example.com", password: "wrong-password" })
        ).status,
      );
    }
    const blocked = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "2.2.2.2")
      .send({ email: "ana@example.com", password: "wrong-password" });

    expect(statuses).toEqual(Array(10).fill(401));
    expect(blocked.status).toBe(429);
  });

  it("doesn't count successful logins", async () => {
    const passwordHash = await hashPassword("password123");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      passwordHash,
      status: "ACTIVE",
      role: { name: "PLAYER" },
    });
    const app = serve(createApp());

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      statuses.push((await tryLogin(app, "ana@example.com", "password123")).status);
    }

    expect(statuses).toEqual(Array(12).fill(200));
  });
});

describe("password spraying", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  it("cuts off one address that fails logins across many accounts, a few tries each", async () => {
    const app = serve(createApp());

    const statuses = await repeat(100, (attempt) => tryLogin(app, `student${attempt}@example.com`));
    const blocked = await tryLogin(app, "one-more@example.com");

    expect(statuses).toEqual(Array(100).fill(401));
    expect(blocked.status).toBe(429);
  });
});

describe("registration limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-coach", name: "COACH" });
    // Every email is taken: registrations answer 409 without creating anything.
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1" });
  });

  it("turns away an 11th sign-up from one address within the hour", async () => {
    const app = serve(createApp());
    const register = (attempt: number) =>
      request(app)
        .post("/api/auth/register")
        .send({
          name: "Ana Torres",
          email: `ana${attempt}@example.com`,
          password: "password123",
          role: "COACH",
          acceptDataPolicy: true,
        });

    const statuses = await repeat(10, register);
    const blocked = await register(10);

    expect(statuses).toEqual(Array(10).fill(409));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Demasiados intentos/);
  });
});

describe("the whole API", () => {
  it("reports on every response how much of its per-address budget is left", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers["ratelimit-policy"]).toBeDefined();
  });
});

describe("password reset requests limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  it("turns away a 6th request for the same email and address within the hour", async () => {
    const app = serve(createApp());
    const forgot = () => request(app).post("/api/auth/password/forgot").send({ email: "ana@example.com" });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) statuses.push((await forgot()).status);
    const blocked = await forgot();

    expect(statuses).toEqual(Array(5).fill(200));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Demasiados intentos/);
  });
});
