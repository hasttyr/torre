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
    match: { findUnique: vi.fn() },
    round: { findUnique: vi.fn() },
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(prismaMock)),
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string): string {
  return signSessionToken({ id: "user-1", role });
}

describe("round and result routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a player can't record results (RN-06)", async () => {
    const response = await request(createApp())
      .post("/api/matches/8ac10de7-d281-568d-b784-edbcad9b551f/result")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`)
      .send({ value: "1-0" });

    expect(response.status).toBe(403);
  });

  it("rejects a value outside the RN-03 catalog, including BYE", async () => {
    for (const value of ["2-0", "BYE"]) {
      const response = await request(createApp())
        .post("/api/matches/8ac10de7-d281-568d-b784-edbcad9b551f/result")
        .set("Authorization", `Bearer ${tokenFor("ARBITER")}`)
        .send({ value });
      expect(response.status).toBe(400);
    }
    expect(prismaMock.match.findUnique).not.toHaveBeenCalled();
  });

  it("an arbiter can't manage rounds (publish, swap, discard)", async () => {
    const response = await request(createApp())
      .post("/api/rounds/a55d5c22-8558-53f1-9420-dabc8476bf1c/publish")
      .set("Authorization", `Bearer ${tokenFor("ARBITER")}`);

    expect(response.status).toBe(403);
  });

  it("a manual adjustment requires a reason (RN-09)", async () => {
    const response = await request(createApp())
      .post("/api/rounds/a55d5c22-8558-53f1-9420-dabc8476bf1c/swap")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER")}`)
      .send({
        playerAId: "5b0e3d4e-8f62-4c2a-9a55-0d6b0f1b2c3d",
        playerBId: "6c1f4e5f-9a73-4d3b-8b66-1e7c1a2c3d4e",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("RN-09");
  });

  it("responds 404 for an unknown match", async () => {
    prismaMock.match.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/matches/c9e1260a-31a0-5657-b732-543e871bfee4/result")
      .set("Authorization", `Bearer ${tokenFor("ARBITER")}`)
      .send({ value: "1-0" });

    expect(response.status).toBe(404);
  });
});
