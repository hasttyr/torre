import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { bearer, createUser, resetDatabase, TEST_PASSWORD } from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Asks for a reset link and reads it where development sends it: the server console. */
async function requestResetToken(email: string): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  await request(app).post("/api/auth/password/forgot").send({ email }).expect(200);
  const link = String(log.mock.calls.at(-1)?.[0]).split(" ").at(-1)!;
  log.mockRestore();
  return new URL(link).searchParams.get("token")!;
}

describe("sign-up and sign-in", () => {
  it("registers a player, signs them in and serves their own profile", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({
        name: "Ana Torres",
        email: "ana@example.com",
        password: TEST_PASSWORD,
        role: "PLAYER",
        universityCode: "U100",
        program: "Ingeniería de Sistemas",
        semester: 3,
        acceptDataPolicy: true,
      })
      .expect(201);

    const browser = request.agent(app);
    await browser.post("/api/auth/login").send({ email: "ANA@example.com", password: TEST_PASSWORD }).expect(200);
    const me = await browser.get("/api/users/me").expect(200);

    expect(me.body).toMatchObject({ email: "ana@example.com", role: "PLAYER", player: { universityCode: "U100" } });
  });

  it("refuses a second account with the same email", async () => {
    await createUser(prisma, "COACH", { email: "coach@example.com" });

    const response = await request(app).post("/api/auth/register").send({
      name: "Otro",
      email: "coach@example.com",
      password: TEST_PASSWORD,
      role: "COACH",
      acceptDataPolicy: true,
    });

    expect(response.status).toBe(409);
  });
});

describe("revoking sessions", () => {
  it("resetting the password ends every session opened with the old one", async () => {
    const user = await createUser(prisma, "PLAYER");
    await request(app).get("/api/users/me").set(bearer(user)).expect(200);

    const token = await requestResetToken(user.email);
    await request(app).post("/api/auth/password/reset").send({ token, newPassword: "a-new-password" }).expect(200);

    await request(app).get("/api/users/me").set(bearer(user)).expect(401);
    await request(app).post("/api/auth/login").send({ email: user.email, password: "a-new-password" }).expect(200);
  });

  it("signing out ends the session for good, even though the token hasn't expired", async () => {
    const user = await createUser(prisma, "COACH");

    await request(app).post("/api/auth/logout").set(bearer(user)).expect(204);

    await request(app).get("/api/users/me").set(bearer(user)).expect(401);
  });

  it("a blocked account's old sessions stay dead after it's reactivated", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");
    const user = await createUser(prisma, "ARBITER");

    await request(app)
      .patch(`/api/users/${user.id}/status`)
      .set(bearer(admin))
      .send({ status: "INACTIVE" })
      .expect(200);
    await request(app).patch(`/api/users/${user.id}/status`).set(bearer(admin)).send({ status: "ACTIVE" }).expect(200);

    await request(app).get("/api/users/me").set(bearer(user)).expect(401);
  });

  it("a role change ends the sessions that carried the old role", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");
    const user = await createUser(prisma, "ARBITER");

    await request(app).patch(`/api/users/${user.id}/role`).set(bearer(admin)).send({ role: "ORGANIZER" }).expect(200);

    await request(app).get("/api/users/me").set(bearer(user)).expect(401);
  });
});

describe("cookie sessions", () => {
  const signIn = async (email: string) => {
    const browser = request.agent(app);
    const login = await browser.post("/api/auth/login").send({ email, password: TEST_PASSWORD }).expect(200);
    return { browser, login };
  };

  it("signs in with a cookie script can't read, and hands out no token", async () => {
    const player = await createUser(prisma, "PLAYER");

    const { login } = await signIn(player.email);

    const cookie = String(login.headers["set-cookie"]);
    expect(cookie).toMatch(/^torre_session=[^;]+/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api");
    expect(login.body).toEqual({ user: expect.objectContaining({ email: player.email }) });
  });

  it("is all a browser needs to use the API, until signing out ends it", async () => {
    const player = await createUser(prisma, "PLAYER");
    const { browser } = await signIn(player.email);
    await browser.get("/api/users/me").expect(200);

    const logout = await browser.post("/api/auth/logout").set("Origin", env.corsOrigin).expect(204);

    expect(String(logout.headers["set-cookie"])).toMatch(/torre_session=;.*Expires=Thu, 01 Jan 1970/);
    await browser.get("/api/users/me").expect(401);
  });

  it("refuses a change the cookie carries from another site (CSRF)", async () => {
    const player = await createUser(prisma, "PLAYER");
    const { browser } = await signIn(player.email);

    const forged = await browser.put("/api/users/me").set("Origin", "https://evil.example").send({ name: "Mallory" });
    const genuine = await browser.put("/api/users/me").set("Origin", env.corsOrigin).send({ name: "Ana Torres" });

    expect(forged.status).toBe(403);
    expect(forged.body.code).toBe("CROSS_SITE_REQUEST");
    expect(genuine.status).toBe(200);
  });

  it("still accepts a bearer token from clients that aren't browsers, with no origin to check", async () => {
    const player = await createUser(prisma, "PLAYER");

    await request(app).put("/api/users/me").set(bearer(player)).send({ name: "Ana Torres" }).expect(200);
  });
});
