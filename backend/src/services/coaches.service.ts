import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { LinkPlayerSchemaInput } from "../validators/coaches.schemas";

/** Checks whether a Prisma error is a unique-constraint violation (P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export interface LinkedPlayerDto {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
  linkedAt: Date;
}

/**
 * Links a coach to a player, to follow their progress (HU24).
 *
 * @throws {HttpError} 404 if the player doesn't exist, 409 if already linked.
 */
export async function linkPlayer(
  prisma: PrismaClient,
  coachId: string,
  data: LinkPlayerSchemaInput,
): Promise<LinkedPlayerDto> {
  const player = await prisma.player.findUnique({ where: { id: data.playerId }, include: { user: true } });
  if (!player) {
    throw new HttpError(404, "Jugador no encontrado");
  }

  try {
    const link = await prisma.coachPlayer.create({
      data: { coachId, playerId: data.playerId },
    });
    return {
      playerId: player.id,
      name: player.user.name,
      universityCode: player.universityCode,
      program: player.program,
      semester: player.semester,
      linkedAt: link.createdAt,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Ya estás vinculado con este jugador");
    }
    throw error;
  }
}

/** Lists the players a coach is linked to. */
export async function listLinkedPlayers(prisma: PrismaClient, coachId: string): Promise<LinkedPlayerDto[]> {
  const links = await prisma.coachPlayer.findMany({
    where: { coachId },
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
  }));
}

/**
 * Removes the link between a coach and a player.
 *
 * @throws {HttpError} 404 if no such link exists.
 */
export async function unlinkPlayer(prisma: PrismaClient, coachId: string, playerId: string): Promise<void> {
  const link = await prisma.coachPlayer.findUnique({ where: { coachId_playerId: { coachId, playerId } } });
  if (!link) {
    throw new HttpError(404, "No estás vinculado con este jugador");
  }

  await prisma.coachPlayer.delete({ where: { id: link.id } });
}
