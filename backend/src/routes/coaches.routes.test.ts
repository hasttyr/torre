import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    player: { findUnique: vi.fn() },
    coachPlayer: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "coach-1"): string {
  return jwt.sign({ sub: id, role }, "test-secret", { expiresIn: "1h" });
}

const playerBase = {
  id: "player-1",
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
      .send({ playerId: "player-1" });

    expect(response.status).toBe(201);
    expect(response.body.playerId).toBe("player-1");
    expect(prismaMock.coachPlayer.create.mock.calls[0][0].data).toEqual({ coachId: "coach-1", playerId: "player-1" });
  });

  it("responds 404 when the player doesn't exist", async () => {
    prismaMock.player.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`)
      .send({ playerId: "missing-player" });

    expect(response.status).toBe(404);
  });

  it("responds 409 when already linked to that player", async () => {
    prismaMock.player.findUnique.mockResolvedValue(playerBase);
    prismaMock.coachPlayer.create.mockRejectedValue({ code: "P2002" });

    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`)
      .send({ playerId: "player-1" });

    expect(response.status).toBe(409);
  });

  it("responds 403 for a role without permission (PLAYER)", async () => {
    const response = await request(createApp())
      .post("/api/coaches/players")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`)
      .send({ playerId: "player-1" });

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/coaches/players").send({ playerId: "player-1" });
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
    expect(response.body[0].playerId).toBe("player-1");
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
      .delete("/api/coaches/players/player-1")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(204);
  });

  it("responds 404 when there's no such link", async () => {
    prismaMock.coachPlayer.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .delete("/api/coaches/players/player-1")
      .set("Authorization", `Bearer ${tokenFor("COACH")}`);

    expect(response.status).toBe(404);
  });
});
