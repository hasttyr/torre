import type { Prisma, PrismaClient } from "@prisma/client";

import type { AuthUser } from "../../types/express";

// Data-visibility policies for dashboard widgets: *whose* data a viewer may
// see, independent of *which* widgets their role has (that's the layout,
// see dashboard.service.ts). Kept as small per-role strategies so a new role
// is one more entry, not another branch in every widget.

export type PlayerScope = { kind: "all" } | { kind: "only"; playerIds: string[] };

type PlayerScopeResolver = (prisma: PrismaClient, viewer: AuthUser) => Promise<PlayerScope>;

const everyone: PlayerScopeResolver = async () => ({ kind: "all" });

const PLAYER_SCOPES: Record<string, PlayerScopeResolver> = {
  // A player only ever sees their own numbers.
  PLAYER: async (prisma, viewer) => {
    const player = await prisma.player.findUnique({ where: { userId: viewer.id }, select: { id: true } });
    return { kind: "only", playerIds: player ? [player.id] : [] };
  },
  // A coach sees the players they follow (HU24), nobody else.
  COACH: async (prisma, viewer) => {
    const links = await prisma.coachPlayer.findMany({ where: { coachId: viewer.id }, select: { playerId: true } });
    return { kind: "only", playerIds: links.map((link) => link.playerId) };
  },
  // Same roles that can already search the whole player directory
  // (players.routes.ts) or officiate any of them.
  ARBITER: everyone,
  ORGANIZER: everyone,
  ADMINISTRATOR: everyone,
};

/** Resolves which players' data `viewer` may see. Unknown roles see nobody. */
export function resolvePlayerScope(prisma: PrismaClient, viewer: AuthUser): Promise<PlayerScope> {
  const resolver = PLAYER_SCOPES[viewer.role];
  return resolver ? resolver(prisma, viewer) : Promise.resolve({ kind: "only", playerIds: [] });
}

/** Whether `playerId` falls inside `scope`. */
export function isPlayerInScope(scope: PlayerScope, playerId: string): boolean {
  return scope.kind === "all" || scope.playerIds.includes(playerId);
}

/** Prisma filter restricting a player query to `scope`. */
export function playerWhere(scope: PlayerScope): Prisma.PlayerWhereInput {
  return scope.kind === "all" ? {} : { id: { in: scope.playerIds } };
}

/**
 * Prisma filter for the tournaments `viewer` may see aggregated on a
 * dashboard: an organizer sees what they organize (same rule as
 * /tournaments/mine), an administrator everything, and every other role
 * everything except drafts (CREATED isn't public yet).
 */
export function tournamentWhere(viewer: AuthUser): Prisma.TournamentWhereInput {
  if (viewer.role === "ADMINISTRATOR") return {};
  if (viewer.role === "ORGANIZER") return { organizerId: viewer.id };
  return { status: { not: "CREATED" } };
}
