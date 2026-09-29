import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { bearer, createTournament, createUser, resetDatabase, type TestUser } from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("club rosters", () => {
  it("are for whoever manages clubs, not for any signed-in user", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const player = await createUser(prisma, "PLAYER");
    const club = await prisma.club.create({ data: { name: "Club Central" } });
    await prisma.player.update({ where: { id: player.playerId! }, data: { clubId: club.id } });

    await request(app).get(`/api/clubs/${club.id}/players`).set(bearer(player)).expect(403);
    const roster = await request(app).get(`/api/clubs/${club.id}/players`).set(bearer(organizer)).expect(200);

    expect(roster.body).toHaveLength(1);
  });
});

describe("player search", () => {
  it("never hands out email addresses", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    await createUser(prisma, "PLAYER", { name: "Laura Pérez", email: "laura@uni.edu" });

    const found = await request(app).get("/api/players?q=Laura").set(bearer(organizer)).expect(200);

    expect(found.body).toHaveLength(1);
    expect(JSON.stringify(found.body)).not.toContain("laura@uni.edu");
  });

  it("lets a coach find a player by their exact email, but not sweep the directory by email fragments", async () => {
    const coach = await createUser(prisma, "COACH");
    await createUser(prisma, "PLAYER", { name: "Laura Pérez", email: "laura@uni.edu" });

    const byFragment = await request(app).get("/api/players?q=uni.edu").set(bearer(coach)).expect(200);
    const byEmail = await request(app).get("/api/players?q=LAURA@uni.edu").set(bearer(coach)).expect(200);

    expect(byFragment.body).toEqual([]);
    expect(byEmail.body).toEqual([expect.objectContaining({ name: "Laura Pérez" })]);
  });

  it("only finds active accounts, so a blocked or suppressed person can't be enrolled, linked or assigned", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const blocked = await createUser(prisma, "PLAYER", { name: "Laura Pérez" });
    await prisma.user.update({ where: { id: blocked.id }, data: { status: "INACTIVE" } });

    const found = await request(app).get("/api/players?q=Laura").set(bearer(organizer)).expect(200);

    expect(found.body).toEqual([]);
  });

  it("still lets an organizer search by part of an email", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    await createUser(prisma, "PLAYER", { name: "Laura Pérez", email: "laura@uni.edu" });

    const found = await request(app).get("/api/players?q=uni.edu").set(bearer(organizer)).expect(200);

    expect(found.body).toHaveLength(1);
  });
});

describe("coach links (HU24)", () => {
  // A coach's dashboard widget over one player, and a tournament the player plays in.
  async function playerWithProgress(): Promise<TestUser> {
    const player = await createUser(prisma, "PLAYER");
    await createTournament(prisma, await createUser(prisma, "ORGANIZER"), { status: "IN_PROGRESS", players: [player] });
    await prisma.roleWidget.create({
      data: { role: { connect: { name: "COACH" } }, widgetKey: "PLAYER_SUMMARY", position: 0 },
    });
    return player;
  }

  const summaryOf = (player: TestUser) => `/api/dashboard/widgets/PLAYER_SUMMARY?playerId=${player.playerId}`;

  it("wait for the player's consent: until then the coach sees the request, not the player's progress", async () => {
    const coach = await createUser(prisma, "COACH");
    const player = await playerWithProgress();

    const link = await request(app).post("/api/coaches/players").set(bearer(coach)).send({ playerId: player.playerId });

    expect(link.status).toBe(201);
    expect(link.body).toMatchObject({ playerId: player.playerId, acceptedAt: null });
    expect((await request(app).get("/api/coaches/tournaments").set(bearer(coach)).expect(200)).body).toEqual([]);
    await request(app).get(summaryOf(player)).set(bearer(coach)).expect(403);
    const requests = await request(app).get("/api/users/me/coaches").set(bearer(player)).expect(200);
    expect(requests.body).toEqual([expect.objectContaining({ id: coach.id, acceptedAt: null })]);
  });

  it("follow the player's progress once the player accepts", async () => {
    const coach = await createUser(prisma, "COACH");
    const player = await playerWithProgress();
    await request(app).post("/api/coaches/players").set(bearer(coach)).send({ playerId: player.playerId }).expect(201);

    await request(app).post(`/api/users/me/coaches/${coach.id}/accept`).set(bearer(player)).expect(204);

    const [followed] = (await request(app).get("/api/coaches/players").set(bearer(coach)).expect(200)).body;
    expect(followed.acceptedAt).toEqual(expect.any(String));
    expect((await request(app).get("/api/coaches/tournaments").set(bearer(coach)).expect(200)).body).toHaveLength(1);
    await request(app).get(summaryOf(player)).set(bearer(coach)).expect(200);
  });

  it("can't be accepted on a coach's behalf when that coach never asked", async () => {
    const coach = await createUser(prisma, "COACH");
    const player = await createUser(prisma, "PLAYER");

    const answer = await request(app).post(`/api/users/me/coaches/${coach.id}/accept`).set(bearer(player));

    expect(answer.status).toBe(404);
    expect(answer.body.code).toBe("COACH_NOT_LINKED");
  });

  it("the player can end a coach's access to their progress", async () => {
    const coach = await createUser(prisma, "COACH");
    const player = await createUser(prisma, "PLAYER");
    await request(app).post("/api/coaches/players").set(bearer(coach)).send({ playerId: player.playerId }).expect(201);

    await request(app).delete(`/api/users/me/coaches/${coach.id}`).set(bearer(player)).expect(204);

    expect((await request(app).get("/api/coaches/players").set(bearer(coach)).expect(200)).body).toEqual([]);
    expect((await request(app).get("/api/users/me/coaches").set(bearer(player)).expect(200)).body).toEqual([]);
  });

  it("answers 404 when that coach doesn't follow the player", async () => {
    const coach = await createUser(prisma, "COACH");
    const player = await createUser(prisma, "PLAYER");

    await request(app).delete(`/api/users/me/coaches/${coach.id}`).set(bearer(player)).expect(404);
  });
});
