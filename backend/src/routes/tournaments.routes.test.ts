import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tournament: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    round: { findFirst: vi.fn() },
    player: { findUnique: vi.fn() },
    enrollment: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    tiebreakCriterion: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "user-1"): string {
  return jwt.sign({ sub: id, role }, "test-secret", { expiresIn: "1h" });
}

const tournamentBase = {
  id: "tournament-1",
  name: "Copa Universitaria",
  startDate: new Date("2026-10-01"),
  endDate: new Date("2026-10-03"),
  status: "CREATED",
  format: "swiss",
  roundsCount: null,
  timeControl: null,
  organizerId: "user-1",
  createdAt: new Date("2026-09-17"),
  tiebreakCriteria: [],
};

describe("GET /api/tournaments/mine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the authenticated organizer's tournaments", async () => {
    prismaMock.tournament.findMany.mockResolvedValue([tournamentBase]);

    const response = await request(createApp())
      .get("/api/tournaments/mine")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.tournament.findMany.mock.calls[0][0].where).toEqual({ organizerId: "user-1" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/mine");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tournaments/available", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("any authenticated user sees tournaments with open registration", async () => {
    prismaMock.tournament.findMany.mockResolvedValue([{ ...tournamentBase, status: "REGISTRATION_OPEN" }]);

    const response = await request(createApp())
      .get("/api/tournaments/available")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.tournament.findMany.mock.calls[0][0].where).toEqual({ status: "REGISTRATION_OPEN" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/available");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tournaments/enrolled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the tournaments the authenticated player is enrolled in", async () => {
    prismaMock.player.findUnique.mockResolvedValue({ id: "player-1", userId: "user-1" });
    prismaMock.enrollment.findMany.mockResolvedValue([{ id: "enrollment-1", tournament: tournamentBase }]);

    const response = await request(createApp())
      .get("/api/tournaments/enrolled")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("tournament-1");
  });

  it("returns an empty list when the user has no player profile", async () => {
    prismaMock.player.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get("/api/tournaments/enrolled")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/enrolled");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/tournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a tournament with valid data and responds 201 in CREATED state", async () => {
    prismaMock.tournament.create.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ name: "Copa Universitaria", startDate: "2026-10-01", endDate: "2026-10-03" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("CREATED");
  });

  it("responds 400 with incomplete data", async () => {
    const response = await request(createApp())
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ name: "Copa" });

    expect(response.status).toBe(400);
    expect(prismaMock.tournament.create).not.toHaveBeenCalled();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/tournaments").send({ name: "Copa" });
    expect(response.status).toBe(401);
  });

  it("responds 403 for a role without permission (PLAYER)", async () => {
    const response = await request(createApp())
      .post("/api/tournaments")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`)
      .send({ name: "Copa Universitaria", startDate: "2026-10-01", endDate: "2026-10-03" });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/tournaments/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the owning organizer can see their tournament's detail", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("tournament-1");
  });

  it("an administrator can see any tournament even without being the owner", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "admin-1")}`);

    expect(response.status).toBe(200);
  });

  it("responds 403 for a PLAYER unrelated to the tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "player-1")}`);

    expect(response.status).toBe(403);
  });

  it("responds 403 for an ORGANIZER who isn't the tournament's owner", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "other-organizer")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/tournament-1");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tournaments/:id/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("the owning organizer can see the roster of enrolled players", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);
    prismaMock.enrollment.findMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(prismaMock.enrollment.findMany.mock.calls[0][0].where).toEqual({
      tournamentId: "tournament-1",
      withdrawnAt: null,
    });
  });

  it("responds 403 for a PLAYER querying the roster of an unrelated tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1/players")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "player-1")}`);

    expect(response.status).toBe(403);
    expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
  });

  it("responds 403 for an ARBITER (no access yet until HU18)", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .get("/api/tournaments/tournament-1/players")
      .set("Authorization", `Bearer ${tokenFor("ARBITER", "arbiter-1")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/tournaments/tournament-1/players");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/tournaments/:id/registration/open and /close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens registration when the tournament is in CREATED", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({ ...tournamentBase, status: "CREATED" });
    prismaMock.tournament.update.mockResolvedValue({ ...tournamentBase, status: "REGISTRATION_OPEN" });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/registration/open")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("REGISTRATION_OPEN");
  });

  it("responds 409 when trying to close without having opened first", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({ ...tournamentBase, status: "CREATED" });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/registration/close")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(409);
  });
});

describe("POST /api/tournaments/:id/players", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enrolls a player and responds 201", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({ ...tournamentBase, status: "REGISTRATION_OPEN" });
    prismaMock.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });
    prismaMock.enrollment.create.mockResolvedValue({ id: "enrollment-1", createdAt: new Date("2026-09-17") });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({ playerId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ playerId: "player-1", name: "Luis Gómez" });
  });

  it("responds 409 (RN-01) for a player already enrolled in the same tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({ ...tournamentBase, status: "REGISTRATION_OPEN" });
    prismaMock.player.findUnique.mockResolvedValue({
      id: "player-1",
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      user: { name: "Luis Gómez" },
    });
    prismaMock.enrollment.create.mockRejectedValue({ code: "P2002" });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({ playerId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(409);
  });

  it("responds 409 when registration is not open", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue({ ...tournamentBase, status: "REGISTRATION_CLOSED" });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({ playerId: "11111111-1111-1111-1111-111111111111" });

    expect(response.status).toBe(409);
    expect(prismaMock.enrollment.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/tournaments/:id/players/:playerId/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("withdraws an actively enrolled player and records the audit trail (HU27/RN-11)", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);
    prismaMock.enrollment.findUnique.mockResolvedValue({
      id: "enrollment-1",
      withdrawnAt: null,
      player: { user: { name: "Luis Gómez" } },
    });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players/player-1/withdraw")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({ reason: "Motivos personales" });

    expect(response.status).toBe(204);
    expect(prismaMock.enrollment.update.mock.calls[0][0]).toMatchObject({
      where: { id: "enrollment-1" },
      data: { withdrawnAt: expect.any(Date) },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "PLAYER_WITHDRAWN",
        detail: 'Luis Gómez de "Copa Universitaria" — Motivos personales',
      },
      select: { id: true },
    });
  });

  it("responds 404 when the player isn't actively enrolled", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);
    prismaMock.enrollment.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players/player-1/withdraw")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({});

    expect(response.status).toBe(404);
    expect(prismaMock.enrollment.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the player was already withdrawn", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);
    prismaMock.enrollment.findUnique.mockResolvedValue({
      id: "enrollment-1",
      withdrawnAt: new Date("2026-09-01"),
      player: { user: { name: "Luis Gómez" } },
    });

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players/player-1/withdraw")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({});

    expect(response.status).toBe(404);
  });

  it("responds 403 for an organizer who doesn't own the tournament", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(tournamentBase);

    const response = await request(createApp())
      .post("/api/tournaments/tournament-1/players/player-1/withdraw")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "other-user")}`)
      .send({});

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/tournaments/tournament-1/players/player-1/withdraw");
    expect(response.status).toBe(401);
  });
});
