import type { PrismaClient } from "@prisma/client";

import type { DataRequestSchemaInput } from "../validators/users.schemas";
import { toUserDto, type UserDto } from "./user.mapper";
import { getUserById, updateOwnProfile } from "./users.service";

export interface DataRightResult {
  type: DataRequestSchemaInput["type"];
  status: "RESOLVED" | "BLOCKED";
  message: string;
  user: UserDto;
}

// Tournament states in which a player's enrollment data is still needed to
// run the competition (CA HU22: suppression is blocked, not denied, while
// this holds).
const ACTIVE_TOURNAMENT_STATUSES = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"] as const;

/** Checks whether the user (as a player) is enrolled in any tournament still in progress. */
async function hasActiveEnrollments(prisma: PrismaClient, userId: string): Promise<boolean> {
  const player = await prisma.player.findUnique({ where: { userId } });
  if (!player) {
    return false;
  }

  const activeEnrollment = await prisma.enrollment.findFirst({
    where: { playerId: player.id, tournament: { status: { in: [...ACTIVE_TOURNAMENT_STATUSES] } } },
  });
  return activeEnrollment !== null;
}

/** Suppresses (anonymizes) an account with no active tournament constraint. */
async function suppressUnblocked(prisma: PrismaClient, userId: string): Promise<UserDto> {
  const hasPlayerProfile = (await prisma.player.findUnique({ where: { userId } })) !== null;
  // Anonymize instead of a hard row delete: other tables (Tournament.organizerId,
  // historic Enrollment/Standing rows) reference this user, and Prisma
  // doesn't cascade those relations. Same status-flag approach the rest of
  // the schema already uses for "removed" states (see UserStatus).
  //
  // The player profile (if any) stays for the same reason — past games and
  // standings point at it — but every personal field on it is erased too,
  // above all the sensitive ones (disability, gender, birth date: Ley 1581
  // art. 5). Only what keeps historic results readable survives.
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: "Usuario eliminado",
      email: `eliminado-${userId}@torre.invalid`,
      status: "INACTIVE",
      // A nested update on a missing profile would fail, hence the check.
      ...(hasPlayerProfile
        ? {
            player: {
              update: {
                universityCode: "—",
                program: "—",
                birthDate: null,
                gender: null,
                disability: null,
                clubId: null,
              },
            },
          }
        : {}),
    },
    include: { role: true, player: true },
  });
  return toUserDto(user);
}

/** Blocks (deactivates) an account whose data is still needed by an ongoing tournament. */
async function blockForActiveTournament(prisma: PrismaClient, userId: string): Promise<UserDto> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: "INACTIVE" },
    include: { role: true, player: true },
  });
  return toUserDto(user);
}

/**
 * Exercises a data-subject right (access, rectification or suppression) for
 * the given user (HU22, Ley 1581 de 2012 art. 8). Every exercised right is
 * recorded in `data_requests` for traceability, regardless of outcome.
 *
 * @throws {HttpError} 404 if the user doesn't exist (via getUserById/updateOwnProfile).
 */
export async function exerciseDataRight(
  prisma: PrismaClient,
  userId: string,
  request: DataRequestSchemaInput,
): Promise<DataRightResult> {
  if (request.type === "ACCESS") {
    const user = await getUserById(prisma, userId);
    await prisma.dataRequest.create({ data: { userId, type: "ACCESS", status: "RESOLVED" } });
    return { type: "ACCESS", status: "RESOLVED", message: "Solicitud de acceso atendida", user };
  }

  if (request.type === "RECTIFICATION") {
    const user = await updateOwnProfile(prisma, userId, request.data);
    await prisma.dataRequest.create({
      data: { userId, type: "RECTIFICATION", status: "RESOLVED" },
    });
    return { type: "RECTIFICATION", status: "RESOLVED", message: "Datos actualizados correctamente", user };
  }

  // SUPPRESSION
  const blocked = await hasActiveEnrollments(prisma, userId);
  const user = blocked ? await blockForActiveTournament(prisma, userId) : await suppressUnblocked(prisma, userId);

  await prisma.dataRequest.create({
    data: {
      userId,
      type: "SUPPRESSION",
      status: blocked ? "BLOCKED" : "RESOLVED",
      detail: request.reason,
    },
  });

  return {
    type: "SUPPRESSION",
    status: blocked ? "BLOCKED" : "RESOLVED",
    message: blocked
      ? "La cuenta se bloqueó temporalmente: hay datos indispensables para un torneo en curso"
      : "Los datos personales fueron suprimidos",
    user,
  };
}
