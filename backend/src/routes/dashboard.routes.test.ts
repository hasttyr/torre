import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    roleWidget: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    role: { findUnique: vi.fn() },
    tournament: { groupBy: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string): string {
  return jwt.sign({ sub: "user-1", role }, "test-secret", { expiresIn: "1h" });
}

describe("dashboard routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/dashboard responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/dashboard");
    expect(response.status).toBe(401);
  });

  it("GET /api/dashboard/widgets/:key serves an enabled widget", async () => {
    prismaMock.roleWidget.findMany.mockResolvedValue([{ widgetKey: "TOURNAMENTS_BY_STATUS" }]);
    prismaMock.tournament.groupBy.mockResolvedValue([{ status: "FINISHED", _count: { _all: 3 } }]);

    const response = await request(createApp())
      .get("/api/dashboard/widgets/TOURNAMENTS_BY_STATUS")
      .set("Authorization", `Bearer ${tokenFor("ARBITER")}`);

    expect(response.status).toBe(200);
    expect(response.body).toContainEqual({ status: "FINISHED", count: 3 });
    expect(response.body).toContainEqual({ status: "CREATED", count: 0 });
  });

  it("GET /api/dashboard/widgets/:key responds 400 for an unknown widget", async () => {
    const response = await request(createApp())
      .get("/api/dashboard/widgets/NOPE")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(400);
  });

  it("GET /api/dashboard/widgets/:key responds 403 for a widget the role doesn't have", async () => {
    prismaMock.roleWidget.findMany.mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/dashboard/widgets/USERS_BY_ROLE")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(403);
  });

  it("layout management is admin-only", async () => {
    const response = await request(createApp())
      .put("/api/dashboard/layouts/PLAYER")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({ widgets: [] });

    expect(response.status).toBe(403);
  });

  it("PUT /api/dashboard/layouts/:role rejects the administrator role and duplicated widgets", async () => {
    const admin = `Bearer ${tokenFor("ADMINISTRATOR")}`;

    const adminRole = await request(createApp())
      .put("/api/dashboard/layouts/ADMINISTRATOR")
      .set("Authorization", admin)
      .send({ widgets: [] });
    const duplicated = await request(createApp())
      .put("/api/dashboard/layouts/PLAYER")
      .set("Authorization", admin)
      .send({ widgets: ["TOP_PLAYERS", "TOP_PLAYERS"] });

    expect(adminRole.status).toBe(400);
    expect(duplicated.status).toBe(400);
  });

  it("PUT /api/dashboard/layouts/:role saves the new layout", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-player" });
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.auditLog.create.mockResolvedValue({ id: "log-1" });

    const response = await request(createApp())
      .put("/api/dashboard/layouts/PLAYER")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`)
      .send({ widgets: ["PLAYER_SUMMARY", "TOP_PLAYERS"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ role: "PLAYER", widgets: ["PLAYER_SUMMARY", "TOP_PLAYERS"] });
  });
});
