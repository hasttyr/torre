import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { signSessionToken } from "../services/sessionToken";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    // requireAuth confirms every token is still current (see middlewares/auth.ts).
    user: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }): Promise<{ id: string } | null> => ({
        id: where.id,
      })),
    },
    player: { findUnique: vi.fn() },
    coachPlayer: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "coach-1"): string {
  return signSessionToken({ id: id, role });
}

const playerBase = {
  id: "1713759c-231e-5eef-93fa-5846543beb8b",
  universityCode: "U123",
  program: "Sistemas",
  semester: 5,
  user: { name: "Luis Gómez" },
};

describe("POST /api/coaches/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links a coach to an existing player", async () => {
    prismaMock.player.findUnique.mockResolvedValue(playerBase);
    prismaMock.coachPlayer.create.mockResolvedValue({ id: "link-1", createdAt: new Date("2026-09-19") });

    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`)
      .send({ playerId: "1713759c-231e-5eef-93fa-5846543beb8b" });

    expect(response.status).toBe(201);
    expect(response.body.playerId).toBe("1713759c-231e-5eef-93fa-5846543beb8b");
    expect(prismaMock.coachPlayer.create.mock.calls[0][0].data).toEqual({
      coachId: "coach-1",
      playerId: "1713759c-231e-5eef-93fa-5846543beb8b",
    });
  });

  it("responds 404 when the player doesn't exist", async () => {
    prismaMock.player.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`)
      .send({ playerId: "bb4a7ecc-5071-597f-b681-6d4aa458c6da" });

    expect(response.status).toBe(404);
  });

  it("responds 409 when already linked to that player", async () => {
    prismaMock.player.findUnique.mockResolvedValue(playerBase);
    prismaMock.coachPlayer.create.mockRejectedValue({ code: "P2002" });

    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`)
      .send({ playerId: "1713759c-231e-5eef-93fa-5846543beb8b" });

    expect(response.status).toBe(409);
  });

  it("responds 403 for a role without permission (PLAYER)", async () => {
    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`)
      .send({ playerId: "1713759c-231e-5eef-93fa-5846543beb8b" });

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp())
      .post("/api/coaches/players")
      .send({ playerId: "1713759c-231e-5eef-93fa-5846543beb8b" });
    expect(response.status).toBe(401);
  });
});

describe("GET /api/coaches/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the players linked to the current coach", async () => {
    prismaMock.coachPlayer.findMany.mockResolvedValue([{ createdAt: new Date("2026-09-19"), player: playerBase }]);

    const response = await request(createApp())
      .get("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].playerId).toBe("1713759c-231e-5eef-93fa-5846543beb8b");
  });
});

describe("DELETE /api/coaches/players/:playerId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unlinks a player from the current coach", async () => {
    prismaMock.coachPlayer.findUnique.mockResolvedValue({ id: "link-1" });
    prismaMock.coachPlayer.delete.mockResolvedValue({ id: "link-1" });

    const response = await request(createApp())
      .delete("/api/coaches/players/1713759c-231e-5eef-93fa-5846543beb8b")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(204);
  });

  it("responds 404 when there's no such link", async () => {
    prismaMock.coachPlayer.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .delete("/api/coaches/players/1713759c-231e-5eef-93fa-5846543beb8b")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/coaches/tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const tournamentBase = {
    id: "tournament-1",
    name: "Copa Universitaria",
    startDate: new Date("2026-10-01"),
    endDate: new Date("2026-10-03"),
    status: "REGISTRATION_OPEN",
    format: "swiss",
    roundsCount: null,
    timeControl: null,
    restrictedProgram: null,
    minimumSemester: null,
    organizerId: "organizer-1",
    createdAt: new Date("2026-09-17"),
    tiebreakCriteria: [],
  };

  it("groups the coach's players enrolled in the same tournament", async () => {
    prismaMock.coachPlayer.findMany.mockResolvedValue([
      { playerId: "1713759c-231e-5eef-93fa-5846543beb8b" },
      { playerId: "player-2" },
    ]);
    prismaMock.enrollment.findMany.mockResolvedValue([
      {
        tournament: tournamentBase,
        player: { id: "1713759c-231e-5eef-93fa-5846543beb8b", user: { name: "Luis Gómez" } },
      },
      { tournament: tournamentBase, player: { id: "player-2", user: { name: "Ana Torres" } } },
    ]);

    const response = await request(createApp())
      .get("/api/coaches/tournaments")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("tournament-1");
    expect(response.body[0].myPlayers).toEqual([
      { playerId: "1713759c-231e-5eef-93fa-5846543beb8b", name: "Luis Gómez" },
      { playerId: "player-2", name: "Ana Torres" },
    ]);
  });

  it("returns an empty list when the coach has no linked players", async () => {
    prismaMock.coachPlayer.findMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/coaches/tournaments")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("responds 403 for a role without permission (PLAYER)", async () => {
    const response = await request(createApp())
      .get("/api/coaches/tournaments")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/coaches/tournaments");
    expect(response.status).toBe(401);
  });
});
