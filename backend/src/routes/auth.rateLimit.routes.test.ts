import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    passwordResetRequest: { create: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

type App = ReturnType<typeof createApp>;

const tryLogin = (app: App, email: string, password = "wrong-password") =>
  request(app).post("/api/auth/login").send({ email, password });

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
    const app = createApp();

    expect(await failLogins(app, "ana@example.com", 10)).toEqual(Array(10).fill(401));
    const blocked = await tryLogin(app, "ana@example.com");

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Demasiados intentos/);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("counts per account, so classmates sharing the campus address aren't blocked by someone else's typos", async () => {
    const app = createApp();
    await failLogins(app, "ana@example.com", 10);

    expect((await tryLogin(app, "luis@example.com")).status).toBe(401);
  });

  it("counts an email however it's capitalized or padded", async () => {
    const app = createApp();
    await failLogins(app, "ana@example.com", 10);

    expect((await tryLogin(app, "  ANA@Example.com ")).status).toBe(429);
  });

  it("ignores X-Forwarded-For without TRUST_PROXY set, so it can't be used to dodge the limit", async () => {
    const app = createApp();
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
    const passwordHash = await bcrypt.hash("password123", 4);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      passwordHash,
      status: "ACTIVE",
      role: { name: "PLAYER" },
    });
    const app = createApp();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      statuses.push((await tryLogin(app, "ana@example.com", "password123")).status);
    }

    expect(statuses).toEqual(Array(12).fill(200));
  });
});

describe("password reset requests limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
  });

  it("turns away a 6th request for the same email and address within the hour", async () => {
    const app = createApp();
    const forgot = () => request(app).post("/api/auth/password/forgot").send({ email: "ana@example.com" });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) statuses.push((await forgot()).status);
    const blocked = await forgot();

    expect(statuses).toEqual(Array(5).fill(200));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Demasiados intentos/);
  });
});
