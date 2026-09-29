import type { Prisma, PrismaClient } from "../generated/prisma/client";

import { HttpError } from "../errors/apiErrors";
import type { AuthUser } from "../types/express";
import type { LinkPlayerSchemaInput } from "../validators/coaches.schemas";
import { isUniqueConstraintError } from "./prismaErrors";
import { toTournamentDto } from "./tournament.mapper";
import type { CoachTournamentDto, CoachTournamentPlayerDto, LinkedPlayerDto } from "../contracts/responses";

/** The links a player has accepted: the only ones that show a coach their progress. */
export const ACCEPTED_LINK = { acceptedAt: { not: null } } satisfies Prisma.CoachPlayerWhereInput;

/**
 * Asks to follow a player's progress (HU24). The link is a request until the
 * player accepts it (acceptCoach): until then the coach sees none of it.
 *
 * @throws {HttpError} 404 if the player doesn't exist, 409 if already linked.
 */
export async function linkPlayer(
  prisma: PrismaClient,
  data: LinkPlayerSchemaInput,
  actor: AuthUser,
): Promise<LinkedPlayerDto> {
  const player = await prisma.player.findUnique({ where: { id: data.playerId }, include: { user: true } });
  if (!player) {
    throw new HttpError("PLAYER_NOT_FOUND");
  }

  try {
    const link = await prisma.coachPlayer.create({
      data: { coachId: actor.id, playerId: data.playerId },
    });
    return {
      playerId: player.id,
      name: player.user.name,
      universityCode: player.universityCode,
      program: player.program,
      semester: player.semester,
      linkedAt: link.createdAt,
      acceptedAt: link.acceptedAt,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError("ALREADY_LINKED");
    }
    throw error;
  }
}

/** Lists the players the actor (a coach) follows or has asked to follow. */
export async function listLinkedPlayers(prisma: PrismaClient, actor: AuthUser): Promise<LinkedPlayerDto[]> {
  const links = await prisma.coachPlayer.findMany({
    where: { coachId: actor.id },
    include: { player: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => ({
    playerId: link.player.id,
    name: link.player.user.name,
    universityCode: link.player.universityCode,
    program: link.player.program,
    semester: link.player.semester,
    linkedAt: link.createdAt,
    acceptedAt: link.acceptedAt,
  }));
}

/**
 * Removes the link between a coach and a player.
 *
 * @throws {HttpError} 404 if no such link exists.
 */
export async function unlinkPlayer(prisma: PrismaClient, playerId: string, actor: AuthUser): Promise<void> {
  const link = await prisma.coachPlayer.findUnique({
    where: { coachId_playerId: { coachId: actor.id, playerId } },
  });
  if (!link) {
    throw new HttpError("NOT_LINKED");
  }

  await prisma.coachPlayer.delete({ where: { id: link.id } });
}

/**
 * Lists the tournaments where at least one of the players who accepted the
 * coach is enrolled, together with which of them are enrolled in each one.
 */
export async function listCoachTournaments(prisma: PrismaClient, actor: AuthUser): Promise<CoachTournamentDto[]> {
  const links = await prisma.coachPlayer.findMany({
    where: { coachId: actor.id, ...ACCEPTED_LINK },
    select: { playerId: true },
  });
  const playerIds = links.map((link) => link.playerId);
  if (playerIds.length === 0) {
    return [];
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { playerId: { in: playerIds } },
    include: {
      tournament: { include: { tiebreakCriteria: true } },
      player: { include: { user: true } },
    },
    orderBy: { tournament: { startDate: "asc" } },
  });

  const byTournament = new Map<string, CoachTournamentDto>();
  for (const enrollment of enrollments) {
    const playerEntry = { playerId: enrollment.player.id, name: enrollment.player.user.name };
    const existing = byTournament.get(enrollment.tournament.id);
    if (existing) {
      existing.myPlayers.push(playerEntry);
    } else {
      byTournament.set(enrollment.tournament.id, {
        ...toTournamentDto(enrollment.tournament),
        myPlayers: [playerEntry],
      });
    }
  }

  return Array.from(byTournament.values());
}

/**
 * The player's side of HU24: accepts a coach's request, which gives the coach
 * access to their progress. Accepting twice keeps the first date.
 *
 * @throws {HttpError} 404 if that coach never asked to follow the player.
 */
export async function acceptCoach(prisma: PrismaClient, coachId: string, actor: AuthUser): Promise<void> {
  const link = await prisma.coachPlayer.findFirst({
    where: { coachId, player: { userId: actor.id } },
    select: { id: true, acceptedAt: true },
  });
  if (!link) {
    throw new HttpError("COACH_NOT_LINKED");
  }
  if (!link.acceptedAt) {
    await prisma.coachPlayer.update({ where: { id: link.id }, data: { acceptedAt: new Date() } });
  }
}

/**
 * The player's side of HU24: declines a coach's request, or ends the access
 * already given.
 *
 * @throws {HttpError} 404 if that coach doesn't follow the player.
 */
export async function removeCoach(prisma: PrismaClient, coachId: string, actor: AuthUser): Promise<void> {
  const { count } = await prisma.coachPlayer.deleteMany({ where: { coachId, player: { userId: actor.id } } });
  if (count === 0) {
    throw new HttpError("COACH_NOT_LINKED");
  }
}

export type { CoachTournamentDto, CoachTournamentPlayerDto, LinkedPlayerDto };
