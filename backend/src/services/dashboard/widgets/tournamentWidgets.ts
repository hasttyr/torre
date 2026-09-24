import { TournamentStatus, type PrismaClient } from "@prisma/client";

import type { AuthUser } from "../../../types/express";
import { tournamentWhere } from "../scopes";

// Widgets about tournaments, always filtered by what the viewer may see
// (see tournamentWhere in ../scopes.ts).

export interface TournamentStatusCountDto {
  status: TournamentStatus;
  count: number;
}

/** TOURNAMENTS_BY_STATUS: how many tournaments sit in each lifecycle state. */
export async function loadTournamentsByStatus(
  prisma: PrismaClient,
  viewer: AuthUser,
): Promise<TournamentStatusCountDto[]> {
  const groups = await prisma.tournament.groupBy({
    by: ["status"],
    where: tournamentWhere(viewer),
    _count: { _all: true },
  });

  // Zero-filled and in lifecycle order, so the chart's rows never jump around.
  return Object.values(TournamentStatus).map((status) => ({
    status,
    count: groups.find((group) => group.status === status)?._count._all ?? 0,
  }));
}

export interface UpcomingTournamentDto {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  enrolled: number;
}

const UPCOMING_LIMIT = 6;

/** UPCOMING_TOURNAMENTS: tournaments not yet over (upcoming or in progress), soonest first. */
export async function loadUpcomingTournaments(
  prisma: PrismaClient,
  viewer: AuthUser,
): Promise<UpcomingTournamentDto[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tournaments = await prisma.tournament.findMany({
    where: { AND: [tournamentWhere(viewer), { endDate: { gte: today }, status: { not: "FINISHED" } }] },
    include: { _count: { select: { enrollments: { where: { withdrawnAt: null } } } } },
    orderBy: { startDate: "asc" },
    take: UPCOMING_LIMIT,
  });

  return tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    status: tournament.status,
    enrolled: tournament._count.enrollments,
  }));
}

export interface RecentResultDto {
  id: string;
  tournamentName: string;
  round: number;
  board: number;
  white: string;
  black: string;
  value: string;
  recordedAt: Date;
}

const RECENT_RESULTS_LIMIT = 8;

/** RECENT_RESULTS: the latest recorded games (byes left out: nothing was played). */
export async function loadRecentResults(prisma: PrismaClient, viewer: AuthUser): Promise<RecentResultDto[]> {
  const results = await prisma.result.findMany({
    where: { value: { not: "BYE" }, match: { round: { tournament: tournamentWhere(viewer) } } },
    include: {
      match: {
        include: {
          round: { include: { tournament: { select: { name: true } } } },
          white: { select: { user: { select: { name: true } } } },
          black: { select: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { recordedAt: "desc" },
    take: RECENT_RESULTS_LIMIT,
  });

  return results.map(({ id, value, recordedAt, match }) => ({
    id,
    tournamentName: match.round.tournament.name,
    round: match.round.number,
    board: match.board,
    white: match.white?.user.name ?? "—",
    black: match.black?.user.name ?? "—",
    value,
    recordedAt,
  }));
}
