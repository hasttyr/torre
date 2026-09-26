import type { Club, PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type {
  AssignPlayerSchemaInput,
  CreateClubSchemaInput,
  UpdateClubSchemaInput,
} from "../validators/clubs.schemas";
import { isUniqueConstraintError } from "./prismaErrors";

export interface ClubDto {
  id: string;
  name: string;
  createdAt: Date;
}

/** Maps a Prisma club to its public DTO. */
function toClubDto(club: Club): ClubDto {
  return { id: club.id, name: club.name, createdAt: club.createdAt };
}

/**
 * Creates a new club.
 *
 * @throws {HttpError} 409 if a club with that name already exists.
 */
export async function createClub(prisma: PrismaClient, data: CreateClubSchemaInput): Promise<ClubDto> {
  try {
    const club = await prisma.club.create({ data: { name: data.name.trim() } });
    return toClubDto(club);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Ya existe un club con ese nombre");
    }
    throw error;
  }
}

/** Lists all clubs. */
export async function listClubs(prisma: PrismaClient): Promise<ClubDto[]> {
  const clubs = await prisma.club.findMany({ orderBy: { name: "asc" } });
  return clubs.map(toClubDto);
}

/**
 * Renames a club.
 *
 * @throws {HttpError} 404 if it doesn't exist, 409 if another club already has that name.
 */
export async function updateClub(prisma: PrismaClient, id: string, data: UpdateClubSchemaInput): Promise<ClubDto> {
  const existing = await prisma.club.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "Club no encontrado");
  }

  try {
    const club = await prisma.club.update({ where: { id }, data: { name: data.name.trim() } });
    return toClubDto(club);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Ya existe un club con ese nombre");
    }
    throw error;
  }
}

/**
 * Deletes a club.
 *
 * @throws {HttpError} 404 if it doesn't exist, 409 if it still has players
 * assigned (they must be moved out first — deleting it out from under them
 * would silently orphan their club reference).
 */
export async function deleteClub(prisma: PrismaClient, id: string): Promise<void> {
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) {
    throw new HttpError(404, "Club no encontrado");
  }

  const memberCount = await prisma.player.count({ where: { clubId: id } });
  if (memberCount > 0) {
    throw new HttpError(409, "No se puede eliminar un club con jugadores asignados; quítalos primero");
  }

  await prisma.club.delete({ where: { id } });
}

export interface ClubPlayerDto {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
}

/**
 * Associates a player with a club (a player belongs to at most one club).
 *
 * @throws {HttpError} 404 if the club or player doesn't exist.
 */
export async function assignPlayerToClub(
  prisma: PrismaClient,
  clubId: string,
  data: AssignPlayerSchemaInput,
): Promise<ClubPlayerDto> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new HttpError(404, "Club no encontrado");
  }

  const player = await prisma.player.findUnique({ where: { id: data.playerId }, include: { user: true } });
  if (!player) {
    throw new HttpError(404, "Jugador no encontrado");
  }

  const updated = await prisma.player.update({
    where: { id: data.playerId },
    data: { clubId },
    include: { user: true },
  });

  return {
    playerId: updated.id,
    name: updated.user.name,
    universityCode: updated.universityCode,
    program: updated.program,
    semester: updated.semester,
  };
}

/**
 * Removes a player from a club, if it's currently theirs.
 *
 * @throws {HttpError} 404 if the club/player doesn't exist, or the player doesn't belong to that club.
 */
export async function removePlayerFromClub(prisma: PrismaClient, clubId: string, playerId: string): Promise<void> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.clubId !== clubId) {
    throw new HttpError(404, "El jugador no pertenece a este club");
  }

  await prisma.player.update({ where: { id: playerId }, data: { clubId: null } });
}

/**
 * Lists the players belonging to a club.
 *
 * @throws {HttpError} 404 if the club doesn't exist.
 */
export async function listClubPlayers(prisma: PrismaClient, clubId: string): Promise<ClubPlayerDto[]> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new HttpError(404, "Club no encontrado");
  }

  const players = await prisma.player.findMany({
    where: { clubId },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  return players.map((player) => ({
    playerId: player.id,
    name: player.user.name,
    universityCode: player.universityCode,
    program: player.program,
    semester: player.semester,
  }));
}
