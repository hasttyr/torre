import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getStandings, recalculateStandings } from "./standings.service";

function buildPrismaMock() {
  return {
    tournament: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
    result: { findMany: vi.fn() },
    standing: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    round: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    tiebreakCriterion: { findMany: vi.fn() },
  };
}

const asClient = (prisma: ReturnType<typeof buildPrismaMock>) => prisma as unknown as PrismaClient;

describe("recalculateStandings (HU12/HU13)", () => {
  it("rebuilds the standings from official games only, ranked by the tournament's tiebreaks", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUniqueOrThrow.mockResolvedValue({
      id: "t-1",
      byePoints: 0.5,
      tiebreakCriteria: [{ name: "Resultado particular" }],
    });
    prisma.result.findMany.mockResolvedValue([
      { value: "0-1", match: { whiteId: "a", blackId: "b" } },
      { value: "1-0", match: { whiteId: "a", blackId: "c" } },
      { value: "1-0", match: { whiteId: "b", blackId: "c" } },
      { value: "BYE", match: { whiteId: "c", blackId: null } },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([
      { playerId: "a" },
      { playerId: "b" },
      { playerId: "c" },
      { playerId: "d" },
    ]);

    await recalculateStandings(asClient(prisma), "t-1");

    // RN-04: a draft round's games (its pre-created bye) don't count yet.
    expect(prisma.result.findMany.mock.calls[0][0].where).toEqual({
      match: { round: { tournamentId: "t-1", status: { not: "GENERATED" } } },
    });
    expect(prisma.standing.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: "t-1" } });
    const rows = prisma.standing.createMany.mock.calls[0][0].data;
    expect(
      rows.map((row: { playerId: string; rank: number; score: number }) => [row.rank, row.playerId, row.score]),
    ).toEqual([
      [1, "b", 2],
      [2, "a", 1],
      // The bye is worth the configured 0.5.
      [3, "c", 0.5],
      // Active but without a recorded game yet: listed at 0, not missing.
      [4, "d", 0],
    ]);
  });
});

describe("getStandings (HU14)", () => {
  it("flags the table as pending while the latest round has games without a result", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue({ id: "t-1", status: "IN_PROGRESS", organizerId: "org-1" });
    prisma.standing.findMany.mockResolvedValue([
      {
        rank: 1,
        playerId: "a",
        score: 2,
        buchholz: 1,
        buchholzCut1: 1,
        sonnebornBerger: 1,
        player: { user: { name: "Ana" } },
      },
    ]);
    prisma.round.findMany.mockResolvedValue([{ status: "STANDINGS_UPDATED" }, { status: "RECORDING_RESULTS" }]);
    prisma.enrollment.findMany.mockResolvedValue([{ playerId: "a" }]);
    prisma.tiebreakCriterion.findMany.mockResolvedValue([{ name: "Buchholz" }]);

    const standings = await getStandings(asClient(prisma), "t-1", { id: "u-1", role: "PLAYER" });

    expect(standings).toMatchObject({ pending: true, roundsCompleted: 1, tiebreaks: ["Buchholz"] });
    expect(standings.rows[0]).toMatchObject({ rank: 1, name: "Ana", score: 2, withdrawn: true });
  });
});
