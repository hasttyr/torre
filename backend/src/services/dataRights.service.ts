import type { PrismaClient } from "@prisma/client";

import type { DataRequestSchemaInput } from "../validators/users.schemas";
import { toUserDto, type UserDto } from "./user.mapper";
import { getUserById, updateOwnProfile } from "./users.service";

export interface DataRightResult {
  type: DataRequestSchemaInput["type"];
  status: "RESUELTA" | "BLOQUEADA";
  message: string;
  user: UserDto;
}

// Tournament states in which a player's enrollment data is still needed to
// run the competition (CA HU22: suppression is blocked, not denied, while
// this holds).
const ACTIVE_TOURNAMENT_STATES = ["INSCRIPCIONES_ABIERTAS", "INSCRIPCIONES_CERRADAS", "EN_CURSO"] as const;

/** Checks whether the user (as a player) is enrolled in any tournament still in progress. */
async function hasActiveEnrollments(prisma: PrismaClient, userId: string): Promise<boolean> {
  const player = await prisma.jugador.findUnique({ where: { usuarioId: userId } });
  if (!player) {
    return false;
  }

  const activeEnrollment = await prisma.inscripcion.findFirst({
    where: { jugadorId: player.id, torneo: { estado: { in: [...ACTIVE_TOURNAMENT_STATES] } } },
  });
  return activeEnrollment !== null;
}

/** Suppresses (anonymizes) an account with no active tournament constraint. */
async function suppressUnblocked(prisma: PrismaClient, userId: string): Promise<UserDto> {
  // Anonymize instead of a hard row delete: other tables (Torneo.organizadorId,
  // historic Inscripcion/Clasificacion rows) reference this user, and Prisma
  // doesn't cascade those relations. Same status-flag approach the rest of
  // the schema already uses for "removed" states (see EstadoUsuario).
  const user = await prisma.usuario.update({
    where: { id: userId },
    data: { nombre: "Usuario eliminado", email: `eliminado-${userId}@torre.invalid`, estado: "INACTIVO" },
    include: { rol: true, jugador: true },
  });
  return toUserDto(user);
}

/** Blocks (deactivates) an account whose data is still needed by an ongoing tournament. */
async function blockForActiveTournament(prisma: PrismaClient, userId: string): Promise<UserDto> {
  const user = await prisma.usuario.update({
    where: { id: userId },
    data: { estado: "INACTIVO" },
    include: { rol: true, jugador: true },
  });
  return toUserDto(user);
}

/**
 * Exercises a data-subject right (access, rectification or suppression) for
 * the given user (HU22, Ley 1581 de 2012 art. 8). Every exercised right is
 * recorded in `solicitudes_datos_personales` for traceability, regardless
 * of outcome.
 *
 * @throws {HttpError} 404 if the user doesn't exist (via getUserById/updateOwnProfile).
 */
export async function exerciseDataRight(
  prisma: PrismaClient,
  userId: string,
  request: DataRequestSchemaInput,
): Promise<DataRightResult> {
  if (request.type === "ACCESO") {
    const user = await getUserById(prisma, userId);
    await prisma.solicitudDatosPersonales.create({ data: { usuarioId: userId, tipo: "ACCESO", estado: "RESUELTA" } });
    return { type: "ACCESO", status: "RESUELTA", message: "Solicitud de acceso atendida", user };
  }

  if (request.type === "RECTIFICACION") {
    const user = await updateOwnProfile(prisma, userId, request.data);
    await prisma.solicitudDatosPersonales.create({
      data: { usuarioId: userId, tipo: "RECTIFICACION", estado: "RESUELTA" },
    });
    return { type: "RECTIFICACION", status: "RESUELTA", message: "Datos actualizados correctamente", user };
  }

  // SUPRESION
  const blocked = await hasActiveEnrollments(prisma, userId);
  const user = blocked ? await blockForActiveTournament(prisma, userId) : await suppressUnblocked(prisma, userId);

  await prisma.solicitudDatosPersonales.create({
    data: {
      usuarioId: userId,
      tipo: "SUPRESION",
      estado: blocked ? "BLOQUEADA" : "RESUELTA",
      detalle: request.reason,
    },
  });

  return {
    type: "SUPRESION",
    status: blocked ? "BLOQUEADA" : "RESUELTA",
    message: blocked
      ? "La cuenta se bloqueó temporalmente: hay datos indispensables para un torneo en curso"
      : "Los datos personales fueron suprimidos",
    user,
  };
}
