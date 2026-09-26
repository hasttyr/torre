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
    expect(response.body).toEqual({
      entries: [
        {
          id: "log-1",
          userId: "admin-1",
          userName: "Admin Demo",
          action: "ROLE_CHANGED",
          detail: "Carlos (PLAYER -> ARBITER)",
          createdAt: "2026-09-19T00:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
  });

  describe("one page at a time", () => {
    const logs = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        userId: "admin-1",
        action: "ROLE_CHANGED",
        detail: null,
        createdAt: new Date("2026-09-19"),
        user: { name: "Admin Demo" },
      }));
    const asAdmin = (url: string) =>
      request(createApp())
        .get(url)
        .set("Authorization", `Bearer ${tokenFor("ADMINISTRATOR")}`);

    it("returns the newest 50 by default, with a cursor to the next page when there is one", async () => {
      // One more than the page: that's how it knows another page exists.
      prismaMock.auditLog.findMany.mockResolvedValue(logs(51));

      const response = await asAdmin("/api/audit-logs");

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      );
      expect(response.body.entries).toHaveLength(50);
      expect(response.body.nextCursor).toBe(response.body.entries[49].id);
    });

    it("continues right after the cursor it's given, with the page size asked for", async () => {
      prismaMock.auditLog.findMany.mockResolvedValue(logs(3));
      const cursor = "00000000-0000-4000-8000-000000000009";

      const response = await asAdmin(`/api/audit-logs?cursor=${cursor}&limit=10`);

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 11, cursor: { id: cursor }, skip: 1 }),
      );
      expect(response.body.nextCursor).toBeNull();
    });

    it.each([
      ["a page size of 0", "?limit=0"],
      ["a page size over 100", "?limit=101"],
      ["a page size that isn't a number", "?limit=muchos"],
      ["a cursor that isn't an entry id", "?cursor=log-1"],
    ])("rejects %s with 400", async (_, query) => {
      const response = await asAdmin(`/api/audit-logs${query}`);

      expect(response.status).toBe(400);
      expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    });
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
