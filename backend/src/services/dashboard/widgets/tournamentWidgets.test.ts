import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { loadRecentResults, loadTournamentsByStatus, loadUpcomingTournaments } from "./tournamentWidgets";

const ORGANIZER = { id: "org-1", role: "ORGANIZER" };
const PLAYER = { id: "u-1", role: "PLAYER" };

describe("TOURNAMENTS_BY_STATUS", () => {
  it("zero-fills every status in lifecycle order, within the organizer's own tournaments", async () => {
    const prisma = {
      tournament: { groupBy: vi.fn().mockResolvedValue([{ status: "FINISHED", _count: { _all: 4 } }]) },
    };

    const counts = await loadTournamentsByStatus(prisma as unknown as PrismaClient, ORGANIZER);

    expect(prisma.tournament.groupBy.mock.calls[0][0].where).toEqual({ organizerId: "org-1" });
    expect(counts).toEqual([
      { status: "CREATED", count: 0 },
      { status: "REGISTRATION_OPEN", count: 0 },
      { status: "REGISTRATION_CLOSED", count: 0 },
      { status: "IN_PROGRESS", count: 0 },
      { status: "FINISHED", count: 4 },
    ]);
  });
});

describe("UPCOMING_TOURNAMENTS", () => {
  it("lists unfinished tournaments that haven't ended, hides drafts from players, and counts active players", async () => {
    const prisma = {
      tournament: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "t-1",
            name: "Liga",
            startDate: new Date("2026-09-19"),
            endDate: new Date("2026-09-30"),
            status: "IN_PROGRESS",
            _count: { enrollments: 10 },
          },
        ]),
      },
    };

    const upcoming = await loadUpcomingTournaments(prisma as unknown as PrismaClient, PLAYER);

    const query = prisma.tournament.findMany.mock.calls[0][0];
    expect(query.where.AND[0]).toEqual({ status: { not: "CREATED" } });
    expect(query.where.AND[1]).toMatchObject({ status: { not: "FINISHED" } });
    expect(query.include._count.select.enrollments).toEqual({ where: { withdrawnAt: null } });
    expect(upcoming).toEqual([
      {
        id: "t-1",
        name: "Liga",
        startDate: new Date("2026-09-19"),
        endDate: new Date("2026-09-30"),
        status: "IN_PROGRESS",
        enrolled: 10,
      },
    ]);
  });
});

describe("RECENT_RESULTS", () => {
  it("maps the latest games to readable rows and leaves byes out", async () => {
    const recordedAt = new Date("2026-09-23T15:00:00Z");
    const prisma = {
      result: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "res-1",
            value: "1/2-1/2",
            recordedAt,
            match: {
              board: 2,
              round: { number: 4, tournament: { name: "Liga" } },
              white: { user: { name: "Ana" } },
              black: { user: { name: "Luis" } },
            },
          },
        ]),
      },
    };

    const results = await loadRecentResults(prisma as unknown as PrismaClient, ORGANIZER);

    expect(prisma.result.findMany.mock.calls[0][0].where).toEqual({
      value: { not: "BYE" },
      match: { round: { tournament: { organizerId: "org-1" } } },
    });
    expect(results).toEqual([
      {
        id: "res-1",
        tournamentName: "Liga",
        round: 4,
        board: 2,
        white: "Ana",
        black: "Luis",
        value: "1/2-1/2",
        recordedAt,
      },
    ]);
  });
});
