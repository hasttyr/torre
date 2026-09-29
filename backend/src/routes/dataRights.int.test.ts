import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { SESSION_COOKIE } from "../middlewares/sessionCookie";
import { bearer, createUser, resetDatabase, TEST_PASSWORD, type TestUser } from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const suppress = (user: TestUser, reason?: string) =>
  request(app).post("/api/users/me/data-requests").set(bearer(user)).send({ type: "SUPPRESSION", reason });

/** A tournament being played by `players`, run by `organizer`. */
async function tournamentInProgress(organizer: TestUser, players: TestUser[]) {
  return prisma.tournament.create({
    data: {
      name: "Copa Otoño",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
      status: "IN_PROGRESS",
      organizerId: organizer.id,
      enrollments: { create: players.map((player) => ({ playerId: player.playerId! })) },
    },
  });
}

describe("suppression (HU22, Ley 1581)", () => {
  it("erases the account for good: its password stops working and an administrator can't bring it back", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");
    const player = await createUser(prisma, "PLAYER", { name: "Laura Pérez" });
    await request(app)
      .put("/api/users/me")
      .set(bearer(player))
      .send({ birthDate: "2004-05-06", gender: "FEMALE", disability: "VISUAL" })
      .expect(200);

    const response = await suppress(player).expect(200);
    expect(response.body.status).toBe("RESOLVED");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: player.id }, include: { player: true } });
    expect(stored).toMatchObject({ name: "Usuario eliminado", status: "INACTIVE" });
    expect(stored.email).not.toBe(player.email);
    // The sensitive fields above all (Ley 1581 art. 5).
    expect(stored.player).toMatchObject({
      universityCode: "—",
      program: "—",
      birthDate: null,
      gender: null,
      disability: null,
      clubId: null,
    });
    await request(app).post("/api/auth/login").send({ email: stored.email, password: TEST_PASSWORD }).expect(401);

    const reactivation = await request(app)
      .patch(`/api/users/${player.id}/status`)
      .set(bearer(admin))
      .send({ status: "ACTIVE" });
    expect(reactivation.status).toBe(409);
  });

  it("erases an account without a player profile right away", async () => {
    const coach = await createUser(prisma, "COACH", { name: "Carlos Coach" });

    const response = await suppress(coach).expect(200);

    expect(response.body).toMatchObject({ status: "RESOLVED", user: { name: "Usuario eliminado" } });
  });

  it("ends the coach's view of the player", async () => {
    const coach = await createUser(prisma, "COACH");
    const player = await createUser(prisma, "PLAYER");
    await request(app).post("/api/coaches/players").set(bearer(coach)).send({ playerId: player.playerId }).expect(201);

    await suppress(player).expect(200);

    const linked = await request(app).get("/api/coaches/players").set(bearer(coach)).expect(200);
    expect(linked.body).toEqual([]);
  });

  it("takes the person's name out of the audit trail too", async () => {
    const admin = await createUser(prisma, "ADMINISTRATOR");
    const player = await createUser(prisma, "PLAYER", { name: "Laura Pérez" });
    await request(app).patch(`/api/users/${player.id}/role`).set(bearer(admin)).send({ role: "COACH" }).expect(200);
    const coach = { ...player, token: (await login(player.email)).token };

    await suppress(coach).expect(200);

    const log = await request(app).get("/api/audit-logs").set(bearer(admin)).expect(200);
    expect(JSON.stringify(log.body)).not.toContain("Laura Pérez");
    expect(log.body.entries[0].detail).toContain("Usuario eliminado");
  });

  it("doesn't keep the reason the person gave", async () => {
    const player = await createUser(prisma, "PLAYER");

    await suppress(player, "Me cambio de universidad, Laura Pérez").expect(200);

    const requests = await prisma.dataRequest.findMany({ where: { userId: player.id } });
    expect(requests.map((stored) => stored.detail)).toEqual([null]);
  });

  it("blocks an organizer running a tournament instead of erasing them mid-competition", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    await tournamentInProgress(organizer, []);

    const response = await suppress(organizer).expect(200);

    expect(response.body.status).toBe("BLOCKED");
    expect(await prisma.user.findUniqueOrThrow({ where: { id: organizer.id } })).toMatchObject({
      status: "INACTIVE",
      suppressedAt: null,
    });
  });

  it("finishes a blocked suppression once the tournament that held it ends", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const player = await createUser(prisma, "PLAYER", { name: "Laura Pérez" });
    const tournament = await tournamentInProgress(organizer, [player]);
    expect((await suppress(player, "motivo").expect(200)).body.status).toBe("BLOCKED");

    await request(app).post(`/api/tournaments/${tournament.id}/finish`).set(bearer(organizer)).expect(200);

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(stored.name).toBe("Usuario eliminado");
    expect(stored.suppressedAt).not.toBeNull();
    const requests = await prisma.dataRequest.findMany({ where: { userId: player.id } });
    expect(requests).toEqual([expect.objectContaining({ status: "RESOLVED", detail: null })]);
  });
});

describe("access (HU22, Ley 1581 art. 8)", () => {
  it("hands over everything held about the person, not just the profile", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const coach = await createUser(prisma, "COACH", { name: "Carlos Coach" });
    const player = await createUser(prisma, "PLAYER");
    const rival = await createUser(prisma, "PLAYER", { name: "Rival Uno" });
    const tournament = await tournamentInProgress(organizer, [player, rival]);
    await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        number: 1,
        status: "STANDINGS_UPDATED",
        matches: {
          create: {
            board: 1,
            whiteId: player.playerId,
            blackId: rival.playerId,
            status: "FINISHED",
            result: { create: { value: "1-0" } },
          },
        },
      },
    });
    await request(app).post("/api/coaches/players").set(bearer(coach)).send({ playerId: player.playerId }).expect(201);

    const response = await request(app)
      .post("/api/users/me/data-requests")
      .set(bearer(player))
      .send({ type: "ACCESS" })
      .expect(200);

    expect(response.body.data).toMatchObject({
      profile: { id: player.id, email: player.email },
      coaches: [{ name: "Carlos Coach", acceptedAt: null }],
      tournaments: [{ tournament: { name: "Copa Otoño" }, withdrawnAt: null }],
      games: [{ tournament: "Copa Otoño", round: 1, board: 1, color: "WHITE", opponent: "Rival Uno", result: "1-0" }],
      dataRequests: [],
    });
    // The request itself is on record (HU22 traceability).
    expect(await prisma.dataRequest.findMany({ where: { userId: player.id } })).toEqual([
      expect.objectContaining({ type: "ACCESS", status: "RESOLVED" }),
    ]);
  });
});

/** Signs in again (e.g. after a role change revoked the session): the new session token, from its cookie. */
async function login(email: string): Promise<{ token: string }> {
  const response = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD }).expect(200);
  const cookie = String(response.headers["set-cookie"]);
  return { token: new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(cookie)![1]! };
}

describe("rectification (HU22, Ley 1581 art. 8)", () => {
  const rectify = (user: TestUser, data: object) =>
    request(app).post("/api/users/me/data-requests").set(bearer(user)).send({ type: "RECTIFICATION", data });

  it("corrects the person's own data and keeps a record that they asked", async () => {
    const player = await createUser(prisma, "PLAYER", { name: "Luis Gomez" });

    const answer = await rectify(player, { name: "Luis Gómez", semester: 7 });

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ type: "RECTIFICATION", status: "RESOLVED" });
    expect(answer.body.user).toMatchObject({ name: "Luis Gómez", player: { semester: 7 } });
    expect(await prisma.dataRequest.findMany({ where: { userId: player.id } })).toEqual([
      expect.objectContaining({ type: "RECTIFICATION", status: "RESOLVED" }),
    ]);
  });

  it("appears among the requests an access export lists, without anything the person wrote", async () => {
    const player = await createUser(prisma, "PLAYER");
    await rectify(player, { program: "Medicina" }).expect(200);

    const access = await request(app).post("/api/users/me/data-requests").set(bearer(player)).send({ type: "ACCESS" });

    expect(access.body.data.dataRequests).toEqual([
      { type: "RECTIFICATION", status: "RESOLVED", createdAt: expect.any(String) },
    ]);
  });
});
