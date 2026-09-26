import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadPlayerGameLog,
  loadPlayerPerformanceTrend,
  loadPlayerResultsByColor,
  loadPlayerSummary,
  loadPlayerTournamentHistory,
} from "./playerWidgets";

const ME = "me";

function standing(playerId: string, rank: number, score: number, name = playerId) {
  return {
    playerId,
    rank,
    score,
    buchholz: 10,
    buchholzCut1: 8,
    sonnebornBerger: 5,
    player: { user: { name } },
  };
}

// Two tournaments: a finished one I won, and one in progress where I'm 3rd of 3.
const RANKED = [
  {
    id: "t-1",
    name: "Copa",
    status: "FINISHED",
    startDate: new Date("2026-03-01"),
    standings: [standing(ME, 1, 1.5), standing("b", 2, 0.5)],
  },
  {
    id: "t-2",
    name: "Liga",
    status: "IN_PROGRESS",
    startDate: new Date("2026-09-01"),
    standings: [standing("x", 1, 1), standing("y", 2, 1), standing(ME, 3, 0.5)],
  },
];

// t-1: I beat b with white, drew c with black. t-2: only a bye worth 0.5.
const GAMES = [
  { whiteId: ME, blackId: "b", result: { value: "1-0" }, round: { tournamentId: "t-1", tournament: { byePoints: 1 } } },
  {
    whiteId: "c",
    blackId: ME,
    result: { value: "1/2-1/2" },
    round: { tournamentId: "t-1", tournament: { byePoints: 1 } },
  },
  {
    whiteId: ME,
    blackId: null,
    result: { value: "BYE" },
    round: { tournamentId: "t-2", tournament: { byePoints: 0.5 } },
  },
];

function buildPrismaMock() {
  return {
    match: { findMany: vi.fn().mockResolvedValue(GAMES) },
    tournament: { findMany: vi.fn().mockResolvedValue(RANKED) },
    enrollment: { findMany: vi.fn() },
  };
}

type PrismaMock = ReturnType<typeof buildPrismaMock>;
const asClient = (prisma: PrismaMock) => prisma as unknown as PrismaClient;

describe("player widgets", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("PLAYER_SUMMARY: career totals, titles and best finish over finished tournaments only", async () => {
    const summary = await loadPlayerSummary(asClient(prisma), ME);

    expect(summary).toEqual({
      wins: 1,
      draws: 1,
      losses: 0,
      games: 2,
      byes: 1,
      // 1 + 0.5 + a bye worth 0.5 in its tournament (HU28).
      points: 2,
      scoreRate: 0.75,
      tournamentsPlayed: 2,
      titles: 1,
      bestFinish: 1,
    });
    // RN-04: only games from published rounds count.
    expect(prisma.match.findMany.mock.calls[0][0].where).toMatchObject({
      result: { isNot: null },
      round: { status: { not: "GENERATED" } },
    });
  });

  it("PLAYER_PERFORMANCE_TREND: one point per tournament with games, skipping one with only a bye", async () => {
    const trend = await loadPlayerPerformanceTrend(asClient(prisma), ME);

    expect(trend).toEqual([
      {
        tournamentId: "t-1",
        name: "Copa",
        startDate: RANKED[0].startDate,
        scoreRate: 0.75,
        points: 1.5,
        games: 2,
        rank: 1,
        participants: 2,
      },
    ]);
  });

  it("PLAYER_RESULTS_BY_COLOR: results and score rate with each color", async () => {
    expect(await loadPlayerResultsByColor(asClient(prisma), ME)).toEqual({
      white: { wins: 1, draws: 0, losses: 0, scoreRate: 1 },
      black: { wins: 0, draws: 1, losses: 0, scoreRate: 0.5 },
    });
  });

  it("PLAYER_TOURNAMENT_HISTORY: every enrollment, with standing when there is one", async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { tournament: { ...RANKED[1], endDate: new Date("2026-09-30") }, withdrawnAt: new Date() },
      { tournament: { ...RANKED[0], endDate: new Date("2026-03-03") }, withdrawnAt: null },
      {
        tournament: {
          id: "t-3",
          name: "Futura",
          status: "REGISTRATION_OPEN",
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-02"),
        },
        withdrawnAt: null,
      },
    ]);

    const history = await loadPlayerTournamentHistory(asClient(prisma), ME);

    expect(history.map((entry) => [entry.name, entry.rank, entry.participants, entry.points, entry.withdrawn])).toEqual(
      [
        ["Liga", 3, 3, 0.5, true],
        ["Copa", 1, 2, 1.5, false],
        ["Futura", null, null, null, false],
      ],
    );
  });

  it("PLAYER_GAME_LOG (HU15): each game from the player's side, with color, opponent and outcome", async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: "m-3",
        whiteId: "c",
        blackId: ME,
        result: { value: "0-1", recordedAt: new Date("2026-09-03") },
        round: { number: 3, tournament: { id: "t-2", name: "Liga" } },
        white: { user: { name: "Carlos" } },
        black: { user: { name: "Yo" } },
      },
      {
        id: "m-2",
        whiteId: ME,
        blackId: null,
        result: { value: "BYE", recordedAt: new Date("2026-09-02") },
        round: { number: 2, tournament: { id: "t-2", name: "Liga" } },
        white: { user: { name: "Yo" } },
        black: null,
      },
      {
        id: "m-1",
        whiteId: ME,
        blackId: "b",
        result: { value: "0-1", recordedAt: new Date("2026-09-01") },
        round: { number: 1, tournament: { id: "t-2", name: "Liga" } },
        white: { user: { name: "Yo" } },
        black: { user: { name: "Beto" } },
      },
    ]);

    const log = await loadPlayerGameLog(asClient(prisma), ME);

    expect(log.map((entry) => [entry.round, entry.color, entry.opponent, entry.outcome])).toEqual([
      [3, "BLACK", "Carlos", "WIN"],
      [2, null, null, "BYE"],
      [1, "WHITE", "Beto", "LOSS"],
    ]);
    expect(prisma.match.findMany.mock.calls[0][0].orderBy).toEqual({ result: { recordedAt: "desc" } });
  });
});
