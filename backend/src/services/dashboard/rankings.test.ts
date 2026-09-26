import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { loadRankedTournaments, standingOf } from "./rankings";

function row(playerId: string, rank: number | null, score: number) {
  return {
    playerId,
    rank,
    score,
    buchholz: 1,
    buchholzCut1: 1,
    sonnebornBerger: 1,
    player: { user: { name: playerId } },
  };
}

describe("loadRankedTournaments", () => {
  it("uses the stored official rank, and falls back to the row's position when a rank is missing", async () => {
    const prisma = {
      tournament: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "t-1", name: "Copa", standings: [row("a", 1, 3), row("b", null, 2)] }]),
      },
    };

    const [ranked] = await loadRankedTournaments(prisma as unknown as PrismaClient, { status: "FINISHED" });

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toEqual({ status: "FINISHED", standings: { some: {} } });
    expect(ranked.tournament).toEqual({ id: "t-1", name: "Copa" });
    expect(ranked.ranking.map((entry) => [entry.playerId, entry.rank, entry.playerName])).toEqual([
      ["a", 1, "a"],
      ["b", 2, "b"],
    ]);
    expect(standingOf(ranked, "b")?.score).toBe(2);
    expect(standingOf(ranked, "nobody")).toBeUndefined();
  });
});
