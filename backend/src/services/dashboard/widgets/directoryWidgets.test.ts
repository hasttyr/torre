import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { loadPlayersOverview, loadTopPlayers, loadUsersByRole } from "./directoryWidgets";

describe("PLAYERS_OVERVIEW", () => {
  it("limits a coach to their linked players and tallies each one's official games", async () => {
    const prisma = {
      coachPlayer: { findMany: vi.fn().mockResolvedValue([{ playerId: "p1" }]) },
      player: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "p1", program: "Sistemas", user: { name: "Ana" }, _count: { enrollments: 2 } }]),
      },
      match: {
        findMany: vi.fn().mockResolvedValue([
          { whiteId: "p1", blackId: "x", result: { value: "1-0" }, round: { tournament: { byePoints: 1 } } },
          { whiteId: "x", blackId: "p1", result: { value: "1-0" }, round: { tournament: { byePoints: 1 } } },
        ]),
      },
    };

    const rows = await loadPlayersOverview(prisma as unknown as PrismaClient, { id: "coach-1", role: "COACH" });

    expect(prisma.player.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["p1"] } });
    expect(rows).toEqual([
      {
        playerId: "p1",
        name: "Ana",
        program: "Sistemas",
        tournaments: 2,
        wins: 1,
        draws: 0,
        losses: 1,
        games: 2,
        byes: 0,
        points: 1,
        scoreRate: 0.5,
      },
    ]);
  });
});

describe("TOP_PLAYERS", () => {
  function standing(playerId: string, rank: number, score: number) {
    return {
      playerId,
      rank,
      score,
      buchholz: 0,
      buchholzCut1: 0,
      sonnebornBerger: 0,
      player: { user: { name: playerId } },
    };
  }

  it("ranks by titles, then podiums, then points, over finished tournaments only", async () => {
    const prisma = {
      tournament: {
        findMany: vi.fn().mockResolvedValue([
          { id: "t-1", standings: [standing("ana", 1, 4), standing("luis", 2, 3.5), standing("eva", 4, 5)] },
          { id: "t-2", standings: [standing("luis", 1, 4), standing("eva", 5, 5)] },
          { id: "t-3", standings: [standing("ana", 2, 3)] },
        ]),
      },
    };

    const top = await loadTopPlayers(prisma as unknown as PrismaClient);

    expect(prisma.tournament.findMany.mock.calls[0][0].where).toMatchObject({ status: "FINISHED" });
    // ana and luis tie on titles (1) and podiums (2): luis has more points
    // (7.5 vs 7). eva has the most points but no podium, so she comes last.
    expect(top.map((player) => [player.name, player.titles, player.podiums, player.points])).toEqual([
      ["luis", 1, 2, 7.5],
      ["ana", 1, 2, 7],
      ["eva", 0, 0, 10],
    ]);
  });
});

describe("USERS_BY_ROLE", () => {
  it("lists every role with its active and inactive accounts, zero when there are none", async () => {
    const prisma = {
      role: {
        findMany: vi.fn().mockResolvedValue([
          { id: "r-coach", name: "COACH" },
          { id: "r-player", name: "PLAYER" },
        ]),
      },
      user: {
        groupBy: vi.fn().mockResolvedValue([
          { roleId: "r-player", status: "ACTIVE", _count: { _all: 10 } },
          { roleId: "r-player", status: "INACTIVE", _count: { _all: 2 } },
        ]),
      },
    };

    expect(await loadUsersByRole(prisma as unknown as PrismaClient)).toEqual([
      { role: "COACH", active: 0, inactive: 0 },
      { role: "PLAYER", active: 10, inactive: 2 },
    ]);
  });
});
