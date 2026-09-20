import type { Prisma, PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { UpdateProfileSchemaInput } from "../validators/users.schemas";
import { recordAuditLog } from "./auditLog.service";
import { toUserDto, type UserDto } from "./user.mapper";

const PLAYER_FIELDS = ["universityCode", "program", "semester", "birthDate", "gender", "disability"] as const;

/** Checks whether the update payload touches any player-profile field. */
function hasPlayerChanges(data: UpdateProfileSchemaInput): boolean {
  return PLAYER_FIELDS.some((field) => data[field] !== undefined);
}

/** Builds the Prisma update payload for the player profile from the (partial) input. */
function buildPlayerData(data: UpdateProfileSchemaInput): Prisma.PlayerUpdateWithoutUserInput {
  return {
    ...(data.universityCode !== undefined ? { universityCode: data.universityCode.trim() } : {}),
    ...(data.program !== undefined ? { program: data.program.trim() } : {}),
    ...(data.semester !== undefined ? { semester: data.semester } : {}),
    ...(data.birthDate !== undefined ? { birthDate: data.birthDate } : {}),
    ...(data.gender !== undefined ? { gender: data.gender } : {}),
    ...(data.disability !== undefined ? { disability: data.disability } : {}),
  };
}

/**
 * Fetches a user by id.
 *
 * @throws {HttpError} 404 if no user exists with that id.
 */
export async function getUserById(prisma: PrismaClient, id: string): Promise<UserDto> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true, player: { include: { club: true } } },
  });
  if (!user) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  return toUserDto(user);
}

/**
 * Changes a user's role (admin action).
 *
 * @throws {HttpError} 400 if the role doesn't exist, 404 if the user doesn't exist.
 */
export async function updateUserRole(
  prisma: PrismaClient,
  id: string,
  newRole: string,
  actingAdminId: string,
): Promise<UserDto> {
  const role = await prisma.role.findUnique({ where: { name: newRole } });
  if (!role) {
    throw new HttpError(400, `El rol "${newRole}" no existe`);
  }

  const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await prisma.user.update({
    where: { id },
    data: { roleId: role.id },
    include: { role: true, player: { include: { club: true } } },
  });

  // RN-11: role changes are a critical administrative action.
  await recordAuditLog(
    prisma,
    actingAdminId,
    "ROLE_CHANGED",
    `${existingUser.name} (${existingUser.role.name} -> ${newRole})`,
  );

  return toUserDto(user);
}

// HU20: the user only edits THEIR OWN profile (the :id never comes from the
// body, always from req.user.id in the controller) and never their role —
// this function's payload doesn't even accept that field (see
// validators/users.schemas.ts). Player fields are only updated if the
// user has that profile.
/**
 * Updates the current user's own profile.
 *
 * @throws {HttpError} 404 if the user doesn't exist, 400 if player fields
 * are sent for a user without a player profile.
 */
export async function updateOwnProfile(
  prisma: PrismaClient,
  userId: string,
  data: UpdateProfileSchemaInput,
): Promise<UserDto> {
  const existingUser = await prisma.user.findUnique({ where: { id: userId }, include: { player: true } });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const hasPlayerUpdates = hasPlayerChanges(data);
  if (hasPlayerUpdates && !existingUser.player) {
    throw new HttpError(400, "Este usuario no tiene un perfil de jugador para actualizar");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(hasPlayerUpdates ? { player: { update: buildPlayerData(data) } } : {}),
    },
    include: { role: true, player: { include: { club: true } } },
  });

  return toUserDto(user);
}

export interface MyCoachDto {
  id: string;
  name: string;
  email: string;
}

// HU24 (the player's side of the link): a player can see who follows their
// progress. Empty for a user without a player profile, same rule as
// listEnrolledTournaments in tournaments.service.ts.
/** Lists the coaches linked to the current user (as a player). */
export async function listMyCoaches(prisma: PrismaClient, userId: string): Promise<MyCoachDto[]> {
  const player = await prisma.player.findUnique({ where: { userId } });
  if (!player) {
    return [];
  }

  const links = await prisma.coachPlayer.findMany({
    where: { playerId: player.id },
    include: { coach: true },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => ({ id: link.coach.id, name: link.coach.name, email: link.coach.email }));
}
