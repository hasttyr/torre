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
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "user-1"): string {
  return jwt.sign({ sub: id, role }, "test-secret", { expiresIn: "1h" });
}

describe("GET /api/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists audit entries for an administrator", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        userId: "admin-1",
        action: "ROLE_CHANGED",
        detail: "Carlos (PLAYER -> ARBITER)",
        createdAt: new Date("2026-09-19"),
        user: { name: "Admin Demo" },
      },
    ]);

    const response = await request(createApp())
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: "log-1",
        userId: "admin-1",
        userName: "Admin Demo",
        action: "ROLE_CHANGED",
        detail: "Carlos (PLAYER -> ARBITER)",
        createdAt: "2026-09-19T00:00:00.000Z",
      },
    ]);
  });

  it("responds 403 for a role without permission (ORGANIZER)", async () => {
    const response = await request(createApp())
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`);

    expect(response.status).toBe(403);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/audit-logs");
    expect(response.status).toBe(401);
  });
});
