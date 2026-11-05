import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import { bearer, createTournament, createUser, resetDatabase } from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** A 4-player tournament with round 1 published and one result in, plus a round 2 draft. */
async function tournamentUnderWay() {
  const organizer = await createUser(prisma, "ORGANIZER");
  const players = await Promise.all(
    ["Ana Ruiz", "Beto Gil", "Carla Díaz", "Dario Paz"].map((name, index) =>
      createUser(prisma, "PLAYER", { name, email: `jugador${index}@uni.edu`, program: "Medicina", semester: 7 }),
    ),
  );
  await prisma.player.update({
    where: { id: players[0]!.playerId! },
    data: { gender: "FEMALE", disability: "VISUAL" },
  });
  const tournament = await createTournament(prisma, organizer, {
    status: "REGISTRATION_CLOSED",
    roundsCount: 3,
    players,
  });
  const rounds = `/api/tournaments/${tournament.id}/rounds`;
  const round1 = (await request(app).post(rounds).set(bearer(organizer)).expect(201)).body;
  await request(app).post(`/api/rounds/${round1.id}/publish`).set(bearer(organizer)).expect(200);
  for (const match of round1.matches) {
    await request(app)
      .post(`/api/matches/${match.id}/result`)
      .set(bearer(organizer))
      .send({ value: "1-0" })
      .expect(204);
  }
  return { organizer, players, tournament, rounds };
}

// #140: the room anyone can open without a session, to project it or share it.
describe("the public room", () => {
  it("shows the published rounds and the standings without a session, by name only", async () => {
    const { tournament } = await tournamentUnderWay();

    const room = await request(app).get(`/api/tournaments/public/${tournament.id}`).expect(200);

    expect(room.body.tournament).toMatchObject({ id: tournament.id, name: "Copa Otoño", status: "IN_PROGRESS" });
    expect(room.body.rounds).toHaveLength(1);
    expect(room.body.rounds[0].matches).toHaveLength(2);
    expect(room.body.rounds[0].matches.every((match: { result: string }) => match.result === "1-0")).toBe(true);
    expect(room.body.standings.rows).toHaveLength(4);
    expect(room.body.standings.rows[0]).toEqual({
      rank: 1,
      name: expect.any(String),
      score: 1,
      buchholz: expect.any(Number),
      buchholzCut1: expect.any(Number),
      sonnebornBerger: expect.any(Number),
      withdrawn: false,
    });
  });

  it("never carries anything about a person beyond their name", async () => {
    const { tournament, players } = await tournamentUnderWay();

    const body = JSON.stringify((await request(app).get(`/api/tournaments/public/${tournament.id}`).expect(200)).body);

    for (const leak of ["@uni.edu", "Medicina", "FEMALE", "VISUAL", "organizerId", "universityCode", "semester"]) {
      expect(body).not.toContain(leak);
    }
    for (const player of players) {
      expect(body).not.toContain(player.id);
      expect(body).not.toContain(player.playerId);
    }
  });

  it("leaves out a round that is still a draft", async () => {
    const { organizer, tournament, rounds } = await tournamentUnderWay();
    await request(app).post(rounds).set(bearer(organizer)).expect(201);

    const room = await request(app).get(`/api/tournaments/public/${tournament.id}`).expect(200);

    expect(room.body.rounds.map((round: { number: number }) => round.number)).toEqual([1]);
  });

  it("doesn't exist for a tournament that hasn't published a round, with the same 404 as one that doesn't exist", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const drafts = await Promise.all(
      (["CREATED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"] as const).map((status) =>
        createTournament(prisma, organizer, { status }),
      ),
    );

    for (const draft of drafts) {
      const answer = await request(app).get(`/api/tournaments/public/${draft.id}`).expect(404);
      expect(answer.body.code).toBe("TOURNAMENT_NOT_FOUND");
    }
    await request(app).get("/api/tournaments/public/00000000-0000-4000-8000-000000000000").expect(404);
  });

  it("is listed while being played and once finished, but not before", async () => {
    const { tournament } = await tournamentUnderWay();
    const organizer = await createUser(prisma, "ORGANIZER");
    const finished = await createTournament(prisma, organizer, { status: "FINISHED" });
    await createTournament(prisma, organizer, { status: "REGISTRATION_OPEN" });

    const listed = await request(app).get("/api/tournaments/public/rooms").expect(200);

    expect(listed.body.map((room: { id: string }) => room.id).sort()).toEqual([tournament.id, finished.id].sort());
    expect(JSON.stringify(listed.body)).not.toContain("organizerId");
  });

  it("asks search engines not to index it", async () => {
    const { tournament } = await tournamentUnderWay();

    const room = await request(app).get(`/api/tournaments/public/${tournament.id}`).expect(200);
    const listed = await request(app).get("/api/tournaments/public/rooms").expect(200);

    expect(room.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(listed.headers["x-robots-tag"]).toBe("noindex, nofollow");
  });
});
