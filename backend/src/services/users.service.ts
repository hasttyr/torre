import type { Prisma, PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { UpdateProfileSchemaInput } from "../validators/users.schemas";
import { toUserDto, type UserDto } from "./user.mapper";

const PLAYER_FIELDS = [
  "universityCode",
  "program",
  "semester",
  "birthDate",
  "gender",
  "disability",
] as const;

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
  const user = await prisma.user.findUnique({ where: { id }, include: { role: true, player: true } });
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
export async function updateUserRole(prisma: PrismaClient, id: string, newRole: string): Promise<UserDto> {
  const role = await prisma.role.findUnique({ where: { name: newRole } });
  if (!role) {
    throw new HttpError(400, `El rol "${newRole}" no existe`);
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const user = await prisma.user.update({
    where: { id },
    data: { roleId: role.id },
    include: { role: true, player: true },
  });

  // RN-11 requires logging this change in the audit trail; the AuditLog
  // entity doesn't exist yet (lands in S13, roadmap increment 9). Once it
  // does, this is where the record gets written.
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
    include: { role: true, player: true },
  });

  return toUserDto(user);
}
