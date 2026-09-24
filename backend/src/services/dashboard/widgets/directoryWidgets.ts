import type { PrismaClient } from "@prisma/client";

import type { AuthUser } from "../../../types/express";
import { emptyTally, tallyGames, totalsOf, type PlayerTotals } from "../playerStats";
import { loadRankedTournaments } from "../rankings";
import { playerWhere, resolvePlayerScope } from "../scopes";

// Widgets about a LIST of people: the players the viewer may see, the
// all-time leaderboard, and the user base itself.

export interface PlayerOverviewRowDto extends PlayerTotals {
  playerId: string;
  name: string;
  program: string;
  tournaments: number;
}

/** PLAYERS_OVERVIEW: per-player stats for every player in the viewer's scope (a coach's roster, or everyone). */
export async function loadPlayersOverview(prisma: PrismaClient, viewer: AuthUser): Promise<PlayerOverviewRowDto[]> {
  const scope = await resolvePlayerScope(prisma, viewer);
  const where = playerWhere(scope);

  const [players, matches] = await Promise.all([
    prisma.player.findMany({
      where,
      include: { user: { select: { name: true } }, _count: { select: { enrollments: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.match.findMany({
      where: { result: { isNot: null }, OR: [{ white: where }, { black: where }] },
      select: { whiteId: true, blackId: true, result: { select: { value: true } } },
    }),
  ]);

  const tallies = tallyGames(matches.map((match) => ({ ...match, value: match.result!.value })));

  return players.map((player) => ({
    playerId: player.id,
    name: player.user.name,
    program: player.program,
    tournaments: player._count.enrollments,
    ...totalsOf(tallies.get(player.id) ?? emptyTally()),
  }));
}

export interface TopPlayerDto {
  playerId: string;
  name: string;
  tournaments: number;
  titles: number;
  podiums: number;
  points: number;
}

const TOP_PLAYERS_LIMIT = 10;

/** TOP_PLAYERS: all-time leaderboard over finished tournaments (public results, same for every viewer). */
export async function loadTopPlayers(prisma: PrismaClient): Promise<TopPlayerDto[]> {
  const ranked = await loadRankedTournaments(prisma, { status: "FINISHED" });

  const byPlayer = new Map<string, TopPlayerDto>();
  for (const { ranking } of ranked) {
    for (const row of ranking) {
      const entry = byPlayer.get(row.playerId) ?? {
        playerId: row.playerId,
        name: row.playerName,
        tournaments: 0,
        titles: 0,
        podiums: 0,
        points: 0,
      };
      entry.tournaments += 1;
      entry.points += row.score;
      if (row.rank === 1) entry.titles += 1;
      if (row.rank <= 3) entry.podiums += 1;
      byPlayer.set(row.playerId, entry);
    }
  }

  return Array.from(byPlayer.values())
    .sort((a, b) => b.titles - a.titles || b.podiums - a.podiums || b.points - a.points)
    .slice(0, TOP_PLAYERS_LIMIT);
}

export interface UsersByRoleDto {
  role: string;
  active: number;
  inactive: number;
}

/** USERS_BY_ROLE: how many active/inactive accounts each role has. */
export async function loadUsersByRole(prisma: PrismaClient): Promise<UsersByRoleDto[]> {
  const [roles, groups] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.user.groupBy({ by: ["roleId", "status"], _count: { _all: true } }),
  ]);

  return roles.map((role) => {
    const countFor = (status: string) =>
      groups.find((group) => group.roleId === role.id && group.status === status)?._count._all ?? 0;
    return { role: role.name, active: countFor("ACTIVE"), inactive: countFor("INACTIVE") };
  });
}
