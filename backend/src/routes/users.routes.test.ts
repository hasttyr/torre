import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { signSessionToken } from "../services/sessionToken";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    role: { findUnique: vi.fn() },
    user: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }): Promise<{ id: string } | null> => ({
        id: where.id,
      })),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    player: { findUnique: vi.fn() },
    coachPlayer: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    enrollment: { findFirst: vi.fn() },
    dataRequest: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    // The active administrators, locked: two of them, so any one can be demoted.
    $queryRaw: vi.fn(async () => [{ id: "admin-1" }, { id: "admin-2" }]),
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(prismaMock)),
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "user-1"): string {
  return signSessionToken({ id: id, role });
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
    prismaMock.coachPlayer.findMany.mockResolvedValue([
      { coach: { id: "coach-1", name: "Marta Ríos", email: "marta@example.com" }, acceptedAt: null },
    ]);

    const response = await request(createApp())
      .get("/api/users/me/coaches")
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: "coach-1", name: "Marta Ríos", email: "marta@example.com", acceptedAt: null },
    ]);
  });

  it("looks the links up through the user's player profile, so someone without one has none", async () => {
    prismaMock.coachPlayer.findMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/users/me/coaches")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "user-1")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(prismaMock.coachPlayer.findMany.mock.calls[0][0].where).toEqual({ player: { userId: "user-1" } });
  });
});

describe("POST /api/users/me/coaches/:coachId/accept", () => {
  const COACH_ID = "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b";
  const accept = () =>
    request(createApp())
      .post(`/api/users/me/coaches/${COACH_ID}/accept`)
      .set("Authorization", `Bearer ${tokenFor("PLAYER", "user-1")}`);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives the coach access to the player's progress from now on (HU24)", async () => {
    prismaMock.coachPlayer.findFirst.mockResolvedValue({ id: "link-1", acceptedAt: null });

    const response = await accept();

    expect(response.status).toBe(204);
    expect(prismaMock.coachPlayer.findFirst.mock.calls[0][0].where).toEqual({
      coachId: COACH_ID,
      player: { userId: "user-1" },
    });
    expect(prismaMock.coachPlayer.update).toHaveBeenCalledWith({
      where: { id: "link-1" },
      data: { acceptedAt: expect.any(Date) },
    });
  });

  it("keeps the original date when the link was already accepted", async () => {
    prismaMock.coachPlayer.findFirst.mockResolvedValue({ id: "link-1", acceptedAt: new Date("2026-09-01") });

    expect((await accept()).status).toBe(204);
    expect(prismaMock.coachPlayer.update).not.toHaveBeenCalled();
  });

  it("answers 404 when that coach never asked to follow the player", async () => {
    prismaMock.coachPlayer.findFirst.mockResolvedValue(null);

    const response = await accept();

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("COACH_NOT_LINKED");
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

  // What each right does against the database is covered by dataRights.int.test.ts.

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
    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/role")
      .send({ role: "ARBITER" });
    expect(response.status).toBe(401);
  });

  it("responds 403 when whoever requests the change isn't ADMINISTRATOR", async () => {
    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/role")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ role: "ARBITER" });

    expect(response.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("allows an ADMINISTRATOR to change another user's role", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-arbiter", name: "ARBITER" });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "f9e9d597-89df-5229-90ca-2ba5b24400fa",
      name: "Carlos",
      role: { name: "PLAYER" },
    });
    prismaMock.user.update.mockResolvedValue({
      id: "f9e9d597-89df-5229-90ca-2ba5b24400fa",
      name: "Carlos",
      email: "carlos@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-arbiter", name: "ARBITER" },
    });

    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "631c2eda-db46-5d29-9750-5c5b1a9b1b9a")}`)
      .send({ role: "ARBITER" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "f9e9d597-89df-5229-90ca-2ba5b24400fa", role: "ARBITER" });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "f9e9d597-89df-5229-90ca-2ba5b24400fa" },
      data: { roleId: "role-arbiter", tokenVersion: { increment: 1 } },
      include: { role: true, player: { include: { club: true } } },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "631c2eda-db46-5d29-9750-5c5b1a9b1b9a",
        action: "ROLE_CHANGED",
        detail: "{{user:f9e9d597-89df-5229-90ca-2ba5b24400fa}} (PLAYER -> ARBITER)",
      },
      select: { id: true },
    });
  });

  it("responds 400 when the sent role isn't one of the valid ones", async () => {
    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`)
      .send({ role: "SUPERUSUARIO" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the target user doesn't exist", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-arbiter", name: "ARBITER" });
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .patch("/api/users/f9c9e62c-e606-5941-bade-a8a568b072fa/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`)
      .send({ role: "ARBITER" });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists every user for an administrator", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Ana Torres",
        email: "ana@example.com",
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        role: { id: "role-1", name: "ORGANIZER" },
        player: null,
      },
    ]);

    const response = await request(createApp())
      .get("/api/users")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: "user-1", role: "ORGANIZER" });
  });

  it("responds 403 for a role without permission (ORGANIZER)", async () => {
    const response = await request(createApp())
      .get("/api/users")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/users");
    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/users/:id/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an ADMINISTRATOR to deactivate another user and records the audit trail", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "f9e9d597-89df-5229-90ca-2ba5b24400fa", name: "Carlos" });
    prismaMock.user.update.mockResolvedValue({
      id: "f9e9d597-89df-5229-90ca-2ba5b24400fa",
      name: "Carlos",
      email: "carlos@example.com",
      status: "INACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "PLAYER" },
    });

    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/status")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "631c2eda-db46-5d29-9750-5c5b1a9b1b9a")}`)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "f9e9d597-89df-5229-90ca-2ba5b24400fa", status: "INACTIVE" });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "631c2eda-db46-5d29-9750-5c5b1a9b1b9a",
        action: "ACCOUNT_STATUS_CHANGED",
        detail: "{{user:f9e9d597-89df-5229-90ca-2ba5b24400fa}} -> INACTIVE",
      },
      select: { id: true },
    });
  });

  it("responds 409 when the admin targets their own account", async () => {
    const response = await request(createApp())
      .patch("/api/users/631c2eda-db46-5d29-9750-5c5b1a9b1b9a/status")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "631c2eda-db46-5d29-9750-5c5b1a9b1b9a")}`)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the target user doesn't exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .patch("/api/users/f9c9e62c-e606-5941-bade-a8a568b072fa/status")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "631c2eda-db46-5d29-9750-5c5b1a9b1b9a")}`)
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(404);
  });

  it("responds 400 with an invalid status", async () => {
    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/status")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR", "631c2eda-db46-5d29-9750-5c5b1a9b1b9a")}`)
      .send({ status: "SUSPENDED" });

    expect(response.status).toBe(400);
  });

  it("responds 403 for a role without permission (ORGANIZER)", async () => {
    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/status")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp())
      .patch("/api/users/f9e9d597-89df-5229-90ca-2ba5b24400fa/status")
      .send({ status: "INACTIVE" });
    expect(response.status).toBe(401);
  });
});

describe("session validity", () => {
  it("rejects a still-unexpired token once the account was deactivated or its role changed", async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce(null);

    const response = await request(createApp())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain("sesión");
  });
});
