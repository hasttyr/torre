import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    // requireAuth confirms every token is still current (see middlewares/auth.ts).
    user: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }): Promise<{ id: string } | null> => ({
        id: where.id,
      })),
    },
    club: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    player: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "user-1"): string {
  return jwt.sign({ sub: id, role }, "test-secret", { expiresIn: "1h" });
}

const clubBase = { id: "club-1", name: "Club Ajedrez Central", createdAt: new Date("2026-09-17") };

describe("POST /api/clubs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a club as an organizer", async () => {
    prismaMock.club.create.mockResolvedValue(clubBase);

    const response = await request(createApp())
      .post("/api/clubs")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ name: "Club Ajedrez Central" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "club-1",
      name: "Club Ajedrez Central",
      createdAt: clubBase.createdAt.toISOString(),
    });
  });

  it("responds 409 for a duplicate club name", async () => {
    prismaMock.club.create.mockRejectedValue({ code: "P2002" });

    const response = await request(createApp())
      .post("/api/clubs")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ name: "Club Ajedrez Central" });

    expect(response.status).toBe(409);
  });

  it("responds 403 for a role without permission (PLAYER)", async () => {
    const response = await request(createApp())
      .post("/api/clubs")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`)
      .send({ name: "Club Ajedrez Central" });

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/clubs").send({ name: "Club Ajedrez Central" });
    expect(response.status).toBe(401);
  });
});

describe("GET /api/clubs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists clubs for any authenticated user", async () => {
    prismaMock.club.findMany.mockResolvedValue([clubBase]);

    const response = await request(createApp())
      .get("/api/clubs")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});

describe("POST /api/clubs/:id/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns a player to the club", async () => {
    prismaMock.club.findUnique.mockResolvedValue(clubBase);
    prismaMock.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U123",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });
    prismaMock.player.update.mockResolvedValue({
      id: "player-1",
      universityCode: "U123",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });

    const response = await request(createApp())
      .post("/api/clubs/club-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ playerId: "player-1" });

    expect(response.status).toBe(201);
    expect(response.body.playerId).toBe("player-1");
  });

  it("responds 404 when the club doesn't exist", async () => {
    prismaMock.club.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/clubs/missing-club/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ playerId: "player-1" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/clubs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes an empty club", async () => {
    prismaMock.club.findUnique.mockResolvedValue(clubBase);
    prismaMock.player.count.mockResolvedValue(0);
    prismaMock.club.delete.mockResolvedValue(clubBase);

    const response = await request(createApp())
      .delete("/api/clubs/club-1")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(204);
    expect(prismaMock.club.delete).toHaveBeenCalledWith({ where: { id: "club-1" } });
  });

  it("responds 409 when the club still has players assigned", async () => {
    prismaMock.club.findUnique.mockResolvedValue(clubBase);
    prismaMock.player.count.mockResolvedValue(2);

    const response = await request(createApp())
      .delete("/api/clubs/club-1")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(409);
    expect(prismaMock.club.delete).not.toHaveBeenCalled();
  });

  it("responds 404 when the club doesn't exist", async () => {
    prismaMock.club.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .delete("/api/clubs/missing-club")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(404);
  });

  it("responds 403 for a role without permission (PLAYER)", async () => {
    const response = await request(createApp())
      .delete("/api/clubs/club-1")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).delete("/api/clubs/club-1");
    expect(response.status).toBe(401);
  });
});
