import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import {
  bearer,
  createTournament,
  createUser,
  raceWithChange,
  resetDatabase,
  type TestUser,
} from "../testing/testDatabase";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createTournamentThroughApi(organizer: TestUser): Promise<string> {
  const response = await request(app)
    .post("/api/tournaments")
    .set(bearer(organizer))
    .send({ name: "Copa Otoño", startDate: "2026-10-01", endDate: "2026-10-02" })
    .expect(201);
  return response.body.id;
}

describe("tiebreak configuration (HU05, RN-05)", () => {
  it("stores the order chosen from the catalog", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const id = await createTournamentThroughApi(organizer);

    await request(app)
      .put(`/api/tournaments/${id}/configuration`)
      .set(bearer(organizer))
      .send({
        tiebreakCriteria: [
          { name: "DIRECT_ENCOUNTER", order: 1 },
          { name: "BUCHHOLZ", order: 2 },
        ],
      })
      .expect(200);

    const tournament = await request(app).get(`/api/tournaments/${id}`).set(bearer(organizer)).expect(200);
    expect(tournament.body.tiebreakCriteria).toEqual([
      { name: "DIRECT_ENCOUNTER", order: 1 },
      { name: "BUCHHOLZ", order: 2 },
    ]);
  });

  it("answers a repeated position with a 400 instead of failing in the database", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const id = await createTournamentThroughApi(organizer);

    const response = await request(app)
      .put(`/api/tournaments/${id}/configuration`)
      .set(bearer(organizer))
      .send({
        tiebreakCriteria: [
          { name: "BUCHHOLZ", order: 1 },
          { name: "SONNEBORN_BERGER", order: 1 },
        ],
      });

    expect(response.status).toBe(400);
  });

  it("can't hold a criterion outside the catalog, even written straight to the database", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const tournamentId = await createTournamentThroughApi(organizer);

    await expect(
      prisma.$executeRaw`INSERT INTO tiebreak_criteria (id, tournament_id, name, "order")
        VALUES (${randomUUID()}, ${tournamentId}, 'Bucholz', 1)`,
      // 22P02: not a value of the Tiebreak enum (the message itself follows the server's locale).
    ).rejects.toThrow(/22P02/);
  });
});

/** A published round 1 of `tournament` pairing the players two by two, with no results yet. */
async function publishedRound(tournamentId: string, players: TestUser[]) {
  return prisma.round.create({
    data: {
      tournamentId,
      number: 1,
      status: "RECORDING_RESULTS",
      matches: {
        create: [0, 2].map((first, index) => ({
          board: index + 1,
          whiteId: players[first]!.playerId,
          blackId: players[first + 1]!.playerId,
        })),
      },
    },
    include: { matches: { orderBy: { board: "asc" } } },
  });
}

const players = (count: number) => Promise.all(Array.from({ length: count }, () => createUser(prisma, "PLAYER")));

describe("concurrent changes to one tournament (B-B2)", () => {
  it("an enrollment that arrives as registration closes is refused, not added to a closed roster", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const [player] = await players(1);
    const tournament = await createTournament(prisma, organizer, { status: "REGISTRATION_OPEN" });

    const enrollment = await raceWithChange(
      prisma,
      tournament.id,
      async () =>
        request(app)
          .post(`/api/tournaments/${tournament.id}/players`)
          .set(bearer(organizer))
          .send({ playerId: player!.playerId }),
      (tx) => tx.tournament.update({ where: { id: tournament.id }, data: { status: "REGISTRATION_CLOSED" } }),
    );

    expect(enrollment.status).toBe(409);
    expect(await prisma.enrollment.count({ where: { tournamentId: tournament.id } })).toBe(0);
  });

  it("closing registration twice at once succeeds only once", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const tournament = await createTournament(prisma, organizer, { status: "REGISTRATION_OPEN" });

    const second = await raceWithChange(
      prisma,
      tournament.id,
      async () => request(app).post(`/api/tournaments/${tournament.id}/registration/close`).set(bearer(organizer)),
      (tx) => tx.tournament.update({ where: { id: tournament.id }, data: { status: "REGISTRATION_CLOSED" } }),
    );

    expect(second.status).toBe(409);
  });

  it("the tiebreak order can't change once round 1 exists, even if round 1 appears mid-request", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const tournament = await createTournament(prisma, organizer, { status: "REGISTRATION_CLOSED", roundsCount: 3 });

    const configure = await raceWithChange(
      prisma,
      tournament.id,
      async () =>
        request(app)
          .put(`/api/tournaments/${tournament.id}/configuration`)
          .set(bearer(organizer))
          .send({ tiebreakCriteria: [{ name: "SONNEBORN_BERGER", order: 1 }] }),
      (tx) => tx.round.create({ data: { tournamentId: tournament.id, number: 1 } }),
    );

    expect(configure.status).toBe(409);
    expect(await prisma.tiebreakCriterion.count({ where: { tournamentId: tournament.id } })).toBe(0);
  });

  it("a result can't be recorded into a tournament that finishes mid-request", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const seated = await players(4);
    const tournament = await createTournament(prisma, organizer, { status: "IN_PROGRESS", players: seated });
    const round = await publishedRound(tournament.id, seated);

    const record = await raceWithChange(
      prisma,
      tournament.id,
      async () =>
        request(app).post(`/api/matches/${round.matches[0]!.id}/result`).set(bearer(organizer)).send({ value: "1-0" }),
      (tx) => tx.tournament.update({ where: { id: tournament.id }, data: { status: "FINISHED" } }),
    );

    expect(record.status).toBe(409);
    expect(await prisma.result.count()).toBe(0);
  });

  it("two results recorded at the same moment both make it into the standings", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const arbiter = await createUser(prisma, "ARBITER");
    const seated = await players(4);
    const tournament = await createTournament(prisma, organizer, { status: "IN_PROGRESS", players: seated });
    const round = await publishedRound(tournament.id, seated);
    const record = async (matchId: string) =>
      request(app).post(`/api/matches/${matchId}/result`).set(bearer(arbiter)).send({ value: "1-0" });

    // Both start while the tournament is busy, and go ahead together once it's free.
    const both = await raceWithChange(
      prisma,
      tournament.id,
      () => Promise.all(round.matches.map((match) => record(match.id))),
      async () => undefined,
    );

    expect(both.map((response) => response.status)).toEqual([204, 204]);
    const standings = await request(app).get(`/api/tournaments/${tournament.id}/standings`).set(bearer(arbiter));
    expect(standings.body.rows.map((row: { score: number }) => row.score).sort()).toEqual([0, 0, 1, 1]);
  });

  it("a round generated twice at once is paired only once", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const seated = await players(4);
    const tournament = await createTournament(prisma, organizer, {
      status: "REGISTRATION_CLOSED",
      roundsCount: 3,
      players: seated,
    });

    const second = await raceWithChange(
      prisma,
      tournament.id,
      async () => request(app).post(`/api/tournaments/${tournament.id}/rounds`).set(bearer(organizer)),
      // The other manager's round 1, still a draft.
      (tx) => tx.round.create({ data: { tournamentId: tournament.id, number: 1 } }),
    );

    expect(second.status).toBe(409);
    expect(await prisma.round.count({ where: { tournamentId: tournament.id } })).toBe(1);
  });

  it("publishing a draft is refused when the tournament finishes mid-request", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const seated = await players(2);
    const tournament = await createTournament(prisma, organizer, {
      status: "IN_PROGRESS",
      roundsCount: 2,
      players: seated,
    });
    const draft = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        number: 1,
        matches: { create: { board: 1, whiteId: seated[0]!.playerId, blackId: seated[1]!.playerId } },
      },
    });

    const publish = await raceWithChange(
      prisma,
      tournament.id,
      async () => request(app).post(`/api/rounds/${draft.id}/publish`).set(bearer(organizer)),
      (tx) => tx.tournament.update({ where: { id: tournament.id }, data: { status: "FINISHED" } }),
    );

    expect(publish.status).toBe(409);
    expect((await prisma.round.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("GENERATED");
  });
});
