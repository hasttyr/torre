import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

// Controller-level contract of the round and result endpoints: status codes,
// what reaches the service, and what comes back. The services themselves
// are covered in services/*.test.ts.

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    // requireAuth confirms every token is still current (see middlewares/auth.ts).
    user: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }): Promise<{ id: string } | null> => ({
        id: where.id,
      })),
    },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../services/rounds.service", () => ({
  listRounds: vi.fn().mockResolvedValue([{ id: "r-1", number: 1 }]),
  generateRound: vi
    .fn()
    .mockResolvedValue({ id: "8a72ea86-e571-5811-ad69-735b423fb932", number: 2, status: "GENERATED" }),
  discardRound: vi.fn().mockResolvedValue(undefined),
  swapPlayers: vi.fn().mockResolvedValue({ id: "8a72ea86-e571-5811-ad69-735b423fb932" }),
  publishRound: vi.fn().mockResolvedValue({ id: "8a72ea86-e571-5811-ad69-735b423fb932", status: "RECORDING_RESULTS" }),
}));
vi.mock("../services/results.service", () => ({
  recordResult: vi.fn().mockResolvedValue(undefined),
  correctResult: vi.fn().mockResolvedValue(undefined),
}));

import { correctResult, recordResult } from "../services/results.service";
import { discardRound, generateRound, listRounds, publishRound, swapPlayers } from "../services/rounds.service";
import { signSessionToken } from "../services/sessionToken";

const bearer = (role: string, id = "user-1") => `Bearer ${signSessionToken({ id: id, role })}`;
const ORGANIZER = { id: "org-1", role: "ORGANIZER" };

describe("round endpoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /tournaments/:id/rounds lists rounds for any signed-in role", async () => {
    const response = await request(createApp())
      .get("/api/tournaments/8eedb80f-c149-5eb9-a514-93f2fb9eeca0/rounds")
      .set("Authorization", bearer("PLAYER"));

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "r-1", number: 1 }]);
    expect(listRounds).toHaveBeenCalledWith(prismaMock, "8eedb80f-c149-5eb9-a514-93f2fb9eeca0", {
      id: "user-1",
      role: "PLAYER",
    });
  });

  it("POST /tournaments/:id/rounds creates the next draft (201)", async () => {
    const response = await request(createApp())
      .post("/api/tournaments/8eedb80f-c149-5eb9-a514-93f2fb9eeca0/rounds")
      .set("Authorization", bearer("ORGANIZER", "org-1"));

    expect(response.status).toBe(201);
    expect(generateRound).toHaveBeenCalledWith(prismaMock, "8eedb80f-c149-5eb9-a514-93f2fb9eeca0", ORGANIZER);
  });

  it("POST /rounds/:id/swap passes the validated adjustment on", async () => {
    const body = {
      playerAId: "5b0e3d4e-8f62-4c2a-9a55-0d6b0f1b2c3d",
      playerBId: "6c1f4e5f-9a73-4d3b-8b66-1e7c1a2c3d4e",
      reason: "  Mismo club  ",
    };

    const response = await request(createApp())
      .post("/api/rounds/8a72ea86-e571-5811-ad69-735b423fb932/swap")
      .set("Authorization", bearer("ORGANIZER", "org-1"))
      .send(body);

    expect(response.status).toBe(200);
    expect(swapPlayers).toHaveBeenCalledWith(
      prismaMock,
      "8a72ea86-e571-5811-ad69-735b423fb932",
      { ...body, reason: "Mismo club" },
      ORGANIZER,
    );
  });

  it("POST /rounds/:id/publish and DELETE /rounds/:id", async () => {
    const app = createApp();
    const published = await request(app)
      .post("/api/rounds/8a72ea86-e571-5811-ad69-735b423fb932/publish")
      .set("Authorization", bearer("ORGANIZER", "org-1"));
    const discarded = await request(app)
      .delete("/api/rounds/632dfc18-be3f-57eb-83a8-ce37e20ee667")
      .set("Authorization", bearer("ORGANIZER", "org-1"));

    expect(published.status).toBe(200);
    expect(publishRound).toHaveBeenCalledWith(prismaMock, "8a72ea86-e571-5811-ad69-735b423fb932", ORGANIZER);
    expect(discarded.status).toBe(204);
    expect(discardRound).toHaveBeenCalledWith(prismaMock, "632dfc18-be3f-57eb-83a8-ce37e20ee667", ORGANIZER);
  });
});

describe("result endpoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POST /matches/:id/result records (204)", async () => {
    const response = await request(createApp())
      .post("/api/matches/8ac10de7-d281-568d-b784-edbcad9b551f/result")
      .set("Authorization", bearer("ARBITER"))
      .send({ value: "1/2-1/2" });

    expect(response.status).toBe(204);
    expect(recordResult).toHaveBeenCalledWith(prismaMock, "8ac10de7-d281-568d-b784-edbcad9b551f", "1/2-1/2", {
      id: "user-1",
      role: "ARBITER",
    });
  });

  it("PUT /matches/:id/result corrects, with or without a reason (204)", async () => {
    const app = createApp();
    await request(app)
      .put("/api/matches/8ac10de7-d281-568d-b784-edbcad9b551f/result")
      .set("Authorization", bearer("ARBITER"))
      .send({ value: "0-1", reason: "Planilla" });
    await request(app)
      .put("/api/matches/8ac10de7-d281-568d-b784-edbcad9b551f/result")
      .set("Authorization", bearer("ARBITER"))
      .send({ value: "1-0" });

    expect(correctResult).toHaveBeenNthCalledWith(
      1,
      prismaMock,
      "8ac10de7-d281-568d-b784-edbcad9b551f",
      "0-1",
      "Planilla",
      {
        id: "user-1",
        role: "ARBITER",
      },
    );
    expect(correctResult).toHaveBeenNthCalledWith(
      2,
      prismaMock,
      "8ac10de7-d281-568d-b784-edbcad9b551f",
      "1-0",
      undefined,
      {
        id: "user-1",
        role: "ARBITER",
      },
    );
  });
});
