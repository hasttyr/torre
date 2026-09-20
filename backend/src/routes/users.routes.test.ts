import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    role: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    player: { findUnique: vi.fn() },
    coachPlayer: { findMany: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    dataRequest: { create: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "user-1"): string {
  return jwt.sign({ sub: id, role }, "test-secret", { expiresIn: "1h" });
}

describe("GET /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/users/me");
    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's profile", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "ORGANIZER" },
    });

    const response = await request(createApp())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "user-1", email: "ana@example.com", role: "ORGANIZER" });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      include: { role: true, player: { include: { club: true } } },
    });
  });

  it("includes the player's club when they belong to one (HU23)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "PLAYER" },
      player: {
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
        club: { id: "club-1", name: "Club Ajedrez Central" },
      },
    });

    const response = await request(createApp())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body.player.club).toEqual({ id: "club-1", name: "Club Ajedrez Central" });
  });

  it("responds 404 when the token's user no longer exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(404);
  });
});

describe("GET /api/users/me/coaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/users/me/coaches");
    expect(response.status).toBe(401);
  });

  it("lists the coaches linked to the current player", async () => {
    prismaMock.player.findUnique.mockResolvedValue({ id: "player-1", userId: "user-1" });
    prismaMock.coachPlayer.findMany.mockResolvedValue([
      { coach: { id: "coach-1", name: "Marta Ríos", email: "marta@example.com" } },
    ]);

    const response = await request(createApp())
      .get("/api/users/me/coaches")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "coach-1", name: "Marta Ríos", email: "marta@example.com" }]);
  });

  it("returns an empty list when the user has no player profile", async () => {
    prismaMock.player.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get("/api/users/me/coaches")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("PUT /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the user's own profile (HU20)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      player: { universityCode: "U1", program: "Sistemas", semester: 5 },
    });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "PLAYER" },
      player: { universityCode: "U1", program: "Ingeniería", semester: 6 },
    });

    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ program: "Ingeniería", semester: 6 });

    expect(response.status).toBe(200);
    expect(response.body.player).toMatchObject({ universityCode: "U1", program: "Ingeniería", semester: 6 });
  });

  it("ignores any attempt to send 'role' in the body (not a valid schema field)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", player: null });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Ana T.",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "ORGANIZER" },
      player: null,
    });

    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`)
      .send({ name: "Ana T.", role: "ADMINISTRATOR" });

    expect(response.status).toBe(200);
    expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty("role");
    expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty("roleId");
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).put("/api/users/me").send({ name: "X" });
    expect(response.status).toBe(401);
  });

  it("responds 400 with a name that's too short", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ name: "A" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("updates birthDate, gender and disability from the closed catalog", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      player: { universityCode: "U1", program: "Sistemas", semester: 5 },
    });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "PLAYER" },
      player: {
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
        birthDate: new Date("2005-06-15"),
        gender: "FEMALE",
        disability: "VISUAL",
      },
    });

    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ birthDate: "2005-06-15", gender: "FEMALE", disability: "VISUAL" });

    expect(response.status).toBe(200);
    expect(response.body.player.gender).toBe("FEMALE");
    expect(response.body.player.disability).toBe("VISUAL");
    expect(typeof response.body.player.age).toBe("number");
  });

  it("responds 400 with a gender outside the catalog (doesn't accept free text)", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ gender: "cualquier-cosa" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("responds 400 with a future birth date", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ birthDate: "2099-01-01" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/users/me/data-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/users/me/data-requests").send({ type: "ACCESS" });
    expect(response.status).toBe(401);
  });

  it("ACCESS: returns the user's own data", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "PLAYER" },
      player: null,
    });

    const response = await request(createApp())
      .post("/api/users/me/data-requests")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ type: "ACCESS" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ type: "ACCESS", status: "RESOLVED" });
    expect(response.body.user.email).toBe("ana@example.com");
  });

  it("SUPPRESSION: blocks the account instead of deleting it when a tournament is in progress", async () => {
    prismaMock.player.findUnique.mockResolvedValue({ id: "player-1", userId: "user-1" });
    prismaMock.enrollment.findFirst.mockResolvedValue({ id: "enrollment-1" });
    prismaMock.user.update.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "INACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "PLAYER" },
      player: null,
    });

    const response = await request(createApp())
      .post("/api/users/me/data-requests")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ type: "SUPPRESSION" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ type: "SUPPRESSION", status: "BLOCKED" });
    expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({ status: "INACTIVE" });
  });

  it("responds 400 with an unknown request type", async () => {
    const response = await request(createApp())
      .post("/api/users/me/data-requests")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`)
      .send({ type: "OTRO" });

    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/users/:id/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).patch("/api/users/user-2/role").send({ role: "ARBITER" });
    expect(response.status).toBe(401);
  });

  it("responds 403 when whoever requests the change isn't ADMINISTRATOR", async () => {
    const response = await request(createApp())
      .patch("/api/users/user-2/role")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ role: "ARBITER" });

    expect(response.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("allows an ADMINISTRATOR to change another user's role", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-arbiter", name: "ARBITER" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-2" });
    prismaMock.user.update.mockResolvedValue({
      id: "user-2",
      name: "Carlos",
      email: "carlos@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-arbiter", name: "ARBITER" },
    });

    const response = await request(createApp())
      .patch("/api/users/user-2/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "admin-user")}`)
      .send({ role: "ARBITER" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "user-2", role: "ARBITER" });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { roleId: "role-arbiter" },
      include: { role: true, player: { include: { club: true } } },
    });
  });

  it("responds 400 when the sent role isn't one of the valid ones", async () => {
    const response = await request(createApp())
      .patch("/api/users/user-2/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`)
      .send({ role: "SUPERUSUARIO" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the target user doesn't exist", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-arbiter", name: "ARBITER" });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .patch("/api/users/no-existe/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`)
      .send({ role: "ARBITER" });

    expect(response.status).toBe(404);
  });
});
