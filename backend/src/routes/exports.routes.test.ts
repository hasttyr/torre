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
    tournament: { findUnique: vi.fn() },
    standing: { findMany: vi.fn() },
    round: { findMany: vi.fn(), findUnique: vi.fn() },
    match: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn(), count: vi.fn() },
    tiebreakCriterion: { findMany: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(role: string, id = "user-1"): string {
  return jwt.sign({ sub: id, role }, "test-secret", { expiresIn: "1h" });
}

const TOURNAMENT = { id: "t-1", name: "Copa Otoño", status: "IN_PROGRESS", organizerId: "org-1", roundsCount: 5 };

describe("PDF export routes (HU30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tournament.findUnique.mockResolvedValue(TOURNAMENT);
    prismaMock.standing.findMany.mockResolvedValue([
      {
        rank: 1,
        playerId: "p1",
        score: 3,
        buchholz: 4,
        buchholzCut1: 3,
        sonnebornBerger: 2,
        player: { user: { name: "Ana Torres" } },
      },
    ]);
    prismaMock.round.findMany.mockResolvedValue([{ status: "STANDINGS_UPDATED" }]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    prismaMock.tiebreakCriterion.findMany.mockResolvedValue([]);
  });

  it("serves the standings as a downloadable PDF to an arbiter", async () => {
    const response = await request(createApp())
      .get("/api/tournaments/t-1/standings.pdf")
      .set("Authorization", `Bearer ${tokenFor("ARBITER")}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["content-disposition"]).toBe('attachment; filename="clasificacion-copa-otono.pdf"');
    expect((response.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("refuses players and coaches (role gate)", async () => {
    for (const role of ["PLAYER", "COACH"]) {
      const response = await request(createApp())
        .get("/api/tournaments/t-1/standings.pdf")
        .set("Authorization", `Bearer ${tokenFor(role)}`);
      expect(response.status).toBe(403);
    }
  });

  it("refuses the organizer of another tournament", async () => {
    const response = await request(createApp())
      .get("/api/tournaments/t-1/standings.pdf")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "org-2")}`);

    expect(response.status).toBe(403);
  });

  it("doesn't export a draft round's pairings", async () => {
    prismaMock.round.findUnique.mockResolvedValue({
      id: "r-2",
      number: 2,
      status: "GENERATED",
      matches: [],
      tournament: TOURNAMENT,
    });

    const response = await request(createApp())
      .get("/api/rounds/r-2/pairings.pdf")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZER", "org-1")}`);

    expect(response.status).toBe(409);
  });
});

describe("GET /api/tournaments/:id/stats (HU16)", () => {
  it("serves a published tournament's statistics to any role", async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(TOURNAMENT);
    prismaMock.match.findMany.mockResolvedValue([
      { whiteId: "a", blackId: "b", result: { value: "1-0" }, round: { number: 1 } },
    ]);
    prismaMock.enrollment.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    const response = await request(createApp())
      .get("/api/tournaments/t-1/stats")
      .set("Authorization", `Bearer ${tokenFor("PLAYER")}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ gamesPlayed: 1, whiteWins: 1, activePlayers: 2, decisiveRate: 1 });
  });
});
