import type { Prisma, PrismaClient } from "../generated/prisma/client";

import { HttpError } from "../errors/apiErrors";
import type { AuthUser } from "../types/express";
import type { UpdateProfileSchemaInput } from "../validators/users.schemas";
import { mention, recordAuditLog } from "./auditLog.service";
import { REVOKE_SESSIONS } from "./sessionToken";
import { toUserDto, type UserDto } from "./user.mapper";
import type { MyCoachDto } from "../contracts/responses";

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
 * Refuses a change that would take away `userId`'s active administrator
 * status (demotion, block, suppression) when they're the last one: nobody
 * could manage roles or accounts anymore. Call it inside the change's
 * transaction: it locks the active administrators' rows, so two of them
 * demoting each other at once are serialized and the second one sees the
 * first's change.
 *
 * @throws {HttpError} 409 if `userId` is the only active administrator.
 */
export async function assertAnotherAdministratorRemains(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const admins = await tx.$queryRaw<{ id: string }[]>`
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'ADMINISTRATOR' AND u.status = 'ACTIVE'
    FOR UPDATE OF u`;
  if (admins.length === 1 && admins[0]!.id === userId) {
    throw new HttpError("LAST_ADMINISTRATOR");
  }
}

// Admin-only oversight (HU03 completion): without this, an administrator
// has no way to discover a user's id to act on it (PATCH .../role,
// .../status) other than looking directly at the database.
/** Lists every user in the system, most recently created first. */
export async function listUsers(prisma: PrismaClient): Promise<UserDto[]> {
  const users = await prisma.user.findMany({
    include: { role: true, player: { include: { club: true } } },
    orderBy: { createdAt: "desc" },
  });
  return users.map(toUserDto);
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
    throw new HttpError("USER_NOT_FOUND");
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
  actor: AuthUser,
): Promise<UserDto> {
  const role = await prisma.role.findUnique({ where: { name: newRole } });
  if (!role) {
    throw new HttpError("ROLE_NOT_FOUND", { role: newRole });
  }

  const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existingUser) {
    throw new HttpError("USER_NOT_FOUND");
  }

  // RN-11: role changes are a critical administrative action, audited in
  // the same transaction as the change itself.
  const user = await prisma.$transaction(async (tx) => {
    if (newRole !== "ADMINISTRATOR") await assertAnotherAdministratorRemains(tx, id);
    const updated = await tx.user.update({
      where: { id },
      data: { roleId: role.id, ...REVOKE_SESSIONS },
      include: { role: true, player: { include: { club: true } } },
    });
    await recordAuditLog(tx, actor.id, "ROLE_CHANGED", `${mention(id)} (${existingUser.role.name} -> ${newRole})`);
    return updated;
  });

  return toUserDto(user);
}

/**
 * Activates or deactivates a user account (admin action).
 *
 * @throws {HttpError} 404 if the user doesn't exist, 409 if the admin
 * targets their own account (would risk locking out the only admin), the
 * last active administrator, or reactivates a suppressed account.
 */
export async function updateUserStatus(
  prisma: PrismaClient,
  id: string,
  status: "ACTIVE" | "INACTIVE",
  actor: AuthUser,
): Promise<UserDto> {
  if (id === actor.id) {
    throw new HttpError("OWN_ACCOUNT_STATUS");
  }

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    throw new HttpError("USER_NOT_FOUND");
  }
  // HU22: suppression is final; there's no one left to reactivate.
  if (existingUser.suppressedAt && status === "ACTIVE") {
    throw new HttpError("ACCOUNT_SUPPRESSED");
  }

  // Blocking/reactivating an account is a critical administrative action,
  // same trust boundary as a role change.
  const user = await prisma.$transaction(async (tx) => {
    if (status === "INACTIVE") await assertAnotherAdministratorRemains(tx, id);
    const updated = await tx.user.update({
      where: { id },
      // Revoked on reactivation too: a block must end the sessions for good.
      data: { status, ...REVOKE_SESSIONS },
      include: { role: true, player: { include: { club: true } } },
    });
    await recordAuditLog(tx, actor.id, "ACCOUNT_STATUS_CHANGED", `${mention(id)} -> ${status}`);
    return updated;
  });

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
  data: UpdateProfileSchemaInput,
  actor: AuthUser,
): Promise<UserDto> {
  const existingUser = await prisma.user.findUnique({ where: { id: actor.id }, include: { player: true } });
  if (!existingUser) {
    throw new HttpError("USER_NOT_FOUND");
  }

  const hasPlayerUpdates = hasPlayerChanges(data);
  if (hasPlayerUpdates && !existingUser.player) {
    throw new HttpError("NOT_A_PLAYER");
  }

  const user = await prisma.user.update({
    where: { id: actor.id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(hasPlayerUpdates ? { player: { update: buildPlayerData(data) } } : {}),
    },
    include: { role: true, player: { include: { club: true } } },
  });

  return toUserDto(user);
}

// HU24 (the player's side of the link): a player can see who follows their
// progress. Empty for a user without a player profile, same rule as
// listEnrolledTournaments in tournaments.service.ts.
/** Lists the coaches who follow the actor (as a player), and the requests waiting for them. */
export async function listMyCoaches(prisma: PrismaClient, actor: AuthUser): Promise<MyCoachDto[]> {
  const links = await prisma.coachPlayer.findMany({
    // Through the actor's player profile: without one, nobody follows them.
    where: { player: { userId: actor.id } },
    include: { coach: true },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => ({
    id: link.coach.id,
    name: link.coach.name,
    email: link.coach.email,
    acceptedAt: link.acceptedAt,
  }));
}

export type { MyCoachDto };
