import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { noticeRoundPublished } from "../services/roundNotices";
import { bearer, createTournament, createUser, resetDatabase } from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// #141: who gets the email when a round is published.
describe("round notices", () => {
  it("go to the players still in the tournament, with an active account, who haven't turned them off", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const [ana, beto, carla, dario] = await Promise.all(
      ["ana", "beto", "carla", "dario"].map((name) => createUser(prisma, "PLAYER", { name, email: `${name}@uni.edu` })),
    );
    const tournament = await createTournament(prisma, organizer, {
      status: "REGISTRATION_CLOSED",
      roundsCount: 3,
      players: [ana!, beto!, carla!, dario!],
    });
    // beto withdrew, carla's account is inactive, dario turned the notices off.
    await prisma.enrollment.updateMany({
      where: { tournamentId: tournament.id, playerId: beto!.playerId! },
      data: { withdrawnAt: new Date() },
    });
    await prisma.user.update({ where: { id: carla!.id }, data: { status: "INACTIVE" } });
    await request(app)
      .put("/api/users/me/notifications")
      .set(bearer(dario!))
      .send({ roundPublished: false })
      .expect(200);
    const round = (
      await request(app).post(`/api/tournaments/${tournament.id}/rounds`).set(bearer(organizer)).expect(201)
    ).body;
    const send = vi.fn().mockResolvedValue(undefined);

    const outcome = await noticeRoundPublished(prisma, { send }, round.id, "https://torre.example");

    expect(outcome).toEqual({ sent: 1, failed: 0 });
    expect(send).toHaveBeenCalledWith(
      "ana@uni.edu",
      expect.objectContaining({ roundNumber: 1, roomLink: `https://torre.example/torneos/${tournament.id}/sala` }),
    );
  });
});

describe("GET/PUT /users/me/notifications", () => {
  it("starts on, and the user turns it off", async () => {
    const player = await createUser(prisma, "PLAYER");

    const initial = await request(app).get("/api/users/me/notifications").set(bearer(player)).expect(200);
    const off = await request(app)
      .put("/api/users/me/notifications")
      .set(bearer(player))
      .send({ roundPublished: false })
      .expect(200);
    const reread = await request(app).get("/api/users/me/notifications").set(bearer(player)).expect(200);

    // Tests run without a mail provider but outside production: the console sender counts as available.
    expect(initial.body).toEqual({ roundPublished: true, emailAvailable: true });
    expect(off.body.roundPublished).toBe(false);
    expect(reread.body.roundPublished).toBe(false);
  });

  it("refuses anything but a yes or no, and anyone without a session", async () => {
    const player = await createUser(prisma, "PLAYER");

    await request(app)
      .put("/api/users/me/notifications")
      .set(bearer(player))
      .send({ roundPublished: "si" })
      .expect(400);
    await request(app).get("/api/users/me/notifications").expect(401);
  });
});
