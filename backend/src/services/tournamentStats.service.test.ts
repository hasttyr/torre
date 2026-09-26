import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { getTournamentStats, summarizeBoards } from "./tournamentStats.service";

describe("summarizeBoards (HU16)", () => {
  it("totals results by color, counts byes apart and splits them per round", () => {
    const summary = summarizeBoards([
      { round: 1, isBye: false, value: "1-0" },
      { round: 1, isBye: false, value: "1/2-1/2" },
      { round: 1, isBye: true, value: "BYE" },
      { round: 2, isBye: false, value: "0-1" },
      { round: 2, isBye: false, value: null },
    ]);

    expect(summary).toMatchObject({ whiteWins: 1, draws: 1, blackWins: 1, gamesPlayed: 3, byes: 1 });
    expect(summary.decisiveRate).toBeCloseTo(2 / 3);
    // White scored 1 + 0.5 + 0 over 3 games.
    expect(summary.whiteScoreRate).toBeCloseTo(0.5);
    expect(summary.rounds).toEqual([
      { round: 1, whiteWins: 1, draws: 1, blackWins: 0, pending: 0 },
      { round: 2, whiteWins: 0, draws: 0, blackWins: 1, pending: 1 },
    ]);
  });

  it("reports null rates before any game is played", () => {
    expect(summarizeBoards([])).toMatchObject({ gamesPlayed: 0, decisiveRate: null, whiteScoreRate: null, rounds: [] });
  });
});

describe("getTournamentStats", () => {
  function buildPrismaMock(status: string) {
    return {
      tournament: { findUnique: vi.fn().mockResolvedValue({ id: "t-1", status, organizerId: "org-1" }) },
      match: { findMany: vi.fn().mockResolvedValue([]) },
      enrollment: { count: vi.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(1) },
    };
  }

  it("counts active and withdrawn players and only looks at published rounds (RN-04)", async () => {
    const prisma = buildPrismaMock("IN_PROGRESS");

    const stats = await getTournamentStats(prisma as unknown as PrismaClient, "t-1", { id: "u-1", role: "COACH" });

    expect(stats).toMatchObject({ tournamentId: "t-1", activePlayers: 8, withdrawnPlayers: 1 });
    expect(prisma.match.findMany.mock.calls[0][0].where).toEqual({
      round: { tournamentId: "t-1", status: { not: "GENERATED" } },
    });
  });

  it("hides a draft tournament's statistics from anyone who doesn't manage it", async () => {
    const prisma = buildPrismaMock("CREATED");

    await expect(
      getTournamentStats(prisma as unknown as PrismaClient, "t-1", { id: "u-1", role: "COACH" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
