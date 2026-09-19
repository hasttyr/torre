import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { ConfigureTournamentSchemaInput, CreateTournamentSchemaInput } from "../validators/tournaments.schemas";
import { toTournamentDto, type TournamentDto } from "./tournament.mapper";

/** Checks whether a Prisma error is a unique-constraint violation (P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

// An organizer only manages their own tournaments; an administrator can act
// on any of them (same rule as updateUserRole in users.service.ts, which
// reserves the role change to ADMINISTRADOR).
/** Throws if `userId`/`rol` aren't allowed to manage the given tournament. */
function assertCanManageTournament(tournament: { organizadorId: string }, userId: string, rol: string): void {
  if (rol !== "ADMINISTRADOR" && tournament.organizadorId !== userId) {
    throw new HttpError(403, "No tenés permiso para administrar este torneo");
  }
}

/** Creates a new tournament owned by `organizadorId`. */
export async function createTournament(
  prisma: PrismaClient,
  organizadorId: string,
  data: CreateTournamentSchemaInput,
): Promise<TournamentDto> {
  const tournament = await prisma.torneo.create({
    data: {
      nombre: data.nombre.trim(),
      fechaInicio: data.fechaInicio,
      fechaFin: data.fechaFin,
      formato: data.formato?.trim() ?? "suizo",
      organizadorId,
    },
    include: { criteriosDesempate: true },
  });

  return toTournamentDto(tournament);
}

// HU26 (pulled forward from S11 to S6, together with Inscripcion): without
// this there's no way to find a tournament already created from the UI
// short of saving the link by hand. An organizer sees only their own; an
// administrator sees all (same rule as assertCanManageTournament).
/** Lists the tournaments the given user organizes (or all of them, for an admin). */
export async function listMyTournaments(prisma: PrismaClient, userId: string, rol: string): Promise<TournamentDto[]> {
  const tournaments = await prisma.torneo.findMany({
    where: rol === "ADMINISTRADOR" ? {} : { organizadorId: userId },
    include: { criteriosDesempate: true },
    orderBy: { createdAt: "desc" },
  });
  return tournaments.map(toTournamentDto);
}

// HU25 (pulled forward from S11 to S6): the listing a player sees to decide
// which tournament to register for. Only INSCRIPCIONES_ABIERTAS counts as
// "available" (CA: "a finished or private tournament doesn't show up");
// CREADO doesn't accept registrations yet either, so it isn't listed.
/** Lists tournaments currently open for registration. */
export async function listAvailableTournaments(prisma: PrismaClient): Promise<TournamentDto[]> {
  const tournaments = await prisma.torneo.findMany({
    where: { estado: "INSCRIPCIONES_ABIERTAS" },
    include: { criteriosDesempate: true },
    orderBy: { fechaInicio: "asc" },
  });
  return tournaments.map(toTournamentDto);
}

// Tournaments where the authenticated user is enrolled as a player,
// regardless of who made the enrollment (today always the organizer, see
// HU07). A user without a Jugador profile (e.g. ORGANIZADOR role) simply
// has no enrollments.
/** Lists tournaments the given user (as a player) is enrolled in. */
export async function listEnrolledTournaments(prisma: PrismaClient, userId: string): Promise<TournamentDto[]> {
  const player = await prisma.jugador.findUnique({ where: { usuarioId: userId } });
  if (!player) {
    return [];
  }

  const enrollments = await prisma.inscripcion.findMany({
    where: { jugadorId: player.id },
    include: { torneo: { include: { criteriosDesempate: true } } },
    orderBy: { createdAt: "desc" },
  });

  return enrollments.map((enrollment) => toTournamentDto(enrollment.torneo));
}

// Restricted to the owning organizer/an administrator: until HU18 exists
// (role-filtered lookup), a specific tournament's detail —and the HU07
// roster in listEnrolledPlayers, which exposes personal data— is only
// visible to whoever manages it. See GET /torneos/disponibles and
// /torneos/inscrito for what any role can query.
/**
 * Fetches a single tournament by id.
 *
 * @throws {HttpError} 404 if it doesn't exist, 403 if the user isn't allowed to manage it.
 */
export async function getTournament(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  rol: string,
): Promise<TournamentDto> {
  const tournament = await prisma.torneo.findUnique({
    where: { id: tournamentId },
    include: { criteriosDesempate: true },
  });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, rol);
  return toTournamentDto(tournament);
}

/**
 * Updates a tournament's rounds, time control, tiebreak order and eligibility rules.
 *
 * @throws {HttpError} 404 if it doesn't exist, 403 if not allowed to manage
 * it, 409 if changing the tiebreak order after round 1 has started.
 */
export async function configureTournament(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  rol: string,
  data: ConfigureTournamentSchemaInput,
): Promise<TournamentDto> {
  const tournament = await prisma.torneo.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, rol);

  if (data.criteriosDesempate) {
    // RN-05: the tiebreak order can only be changed while the tournament is
    // in its preliminary state, i.e. before round 1 exists.
    const firstRound = await prisma.ronda.findFirst({ where: { torneoId: tournamentId, numero: 1 } });
    if (firstRound) {
      throw new HttpError(409, "No se puede modificar el orden de desempates después de iniciada la primera ronda");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.criteriosDesempate) {
      await tx.criterioDesempate.deleteMany({ where: { torneoId: tournamentId } });
      if (data.criteriosDesempate.length > 0) {
        await tx.criterioDesempate.createMany({
          data: data.criteriosDesempate.map((criterion) => ({
            torneoId: tournamentId,
            nombre: criterion.nombre,
            orden: criterion.orden,
          })),
        });
      }
    }

    return tx.torneo.update({
      where: { id: tournamentId },
      data: {
        ...(data.numeroRondas !== undefined ? { numeroRondas: data.numeroRondas } : {}),
        ...(data.ritmo !== undefined ? { ritmo: data.ritmo } : {}),
        ...(data.programaRestringido !== undefined ? { programaRestringido: data.programaRestringido } : {}),
        ...(data.semestreMinimo !== undefined ? { semestreMinimo: data.semestreMinimo } : {}),
      },
      include: { criteriosDesempate: true },
    });
  });

  return toTournamentDto(updated);
}

const REGISTRATION_TRANSITIONS = {
  open: { from: "CREADO", to: "INSCRIPCIONES_ABIERTAS" },
  close: { from: "INSCRIPCIONES_ABIERTAS", to: "INSCRIPCIONES_CERRADAS" },
} as const;

/** Moves a tournament's registration state through one of the allowed transitions. */
async function transitionRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  rol: string,
  action: keyof typeof REGISTRATION_TRANSITIONS,
): Promise<TournamentDto> {
  const tournament = await prisma.torneo.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, rol);

  const { from, to } = REGISTRATION_TRANSITIONS[action];
  if (tournament.estado !== from) {
    throw new HttpError(409, `No se puede pasar de "${tournament.estado}" a "${to}": se requiere estado "${from}"`);
  }

  const updated = await prisma.torneo.update({
    where: { id: tournamentId },
    data: { estado: to },
    include: { criteriosDesempate: true },
  });

  return toTournamentDto(updated);
}

/** Opens registration for a tournament (HU06). */
export function openRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  rol: string,
): Promise<TournamentDto> {
  return transitionRegistration(prisma, tournamentId, userId, rol, "open");
}

/** Closes registration for a tournament (HU06). */
export function closeRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  rol: string,
): Promise<TournamentDto> {
  return transitionRegistration(prisma, tournamentId, userId, rol, "close");
}

export interface EnrolledPlayerDto {
  jugadorId: string;
  nombre: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  inscritoEn: Date;
}

/**
 * Enrolls a player into a tournament (HU07).
 *
 * @throws {HttpError} 404 if the tournament or player doesn't exist, 409 if
 * registration is closed, the player isn't eligible, or is already enrolled.
 */
export async function enrollPlayer(
  prisma: PrismaClient,
  tournamentId: string,
  jugadorId: string,
  userId: string,
  rol: string,
): Promise<EnrolledPlayerDto> {
  const tournament = await prisma.torneo.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, rol);

  // CA HU06: once registration is closed, new enrollments are rejected.
  if (tournament.estado !== "INSCRIPCIONES_ABIERTAS") {
    throw new HttpError(409, "El torneo no tiene las inscripciones abiertas");
  }

  const player = await prisma.jugador.findUnique({ where: { id: jugadorId }, include: { usuario: true } });
  if (!player) {
    throw new HttpError(404, "Jugador no encontrado");
  }

  // Eligibility configured in HU05 (programaRestringido/semestreMinimo): validated
  // here, not in the zod schema, because it depends on tournament and player
  // data, not just the payload's shape.
  if (tournament.programaRestringido && player.programa !== tournament.programaRestringido) {
    throw new HttpError(409, `Este torneo solo admite jugadores del programa "${tournament.programaRestringido}"`);
  }
  if (tournament.semestreMinimo != null && player.semestre < tournament.semestreMinimo) {
    throw new HttpError(409, `Este torneo exige un semestre mínimo de ${tournament.semestreMinimo}`);
  }

  try {
    const enrollment = await prisma.inscripcion.create({
      data: { torneoId: tournamentId, jugadorId },
    });
    return {
      jugadorId: player.id,
      nombre: player.usuario.nombre,
      codigoUniversitario: player.codigoUniversitario,
      programa: player.programa,
      semestre: player.semestre,
      inscritoEn: enrollment.createdAt,
    };
  } catch (error) {
    // RN-01: a player cannot be enrolled twice into the same tournament.
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "El jugador ya está inscrito en este torneo");
    }
    throw error;
  }
}

/** Lists the players enrolled in a tournament. */
export async function listEnrolledPlayers(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  rol: string,
): Promise<EnrolledPlayerDto[]> {
  const tournament = await prisma.torneo.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, rol);

  const enrollments = await prisma.inscripcion.findMany({
    where: { torneoId: tournamentId },
    include: { jugador: { include: { usuario: true } } },
    orderBy: { createdAt: "asc" },
  });

  return enrollments.map((enrollment) => ({
    jugadorId: enrollment.jugador.id,
    nombre: enrollment.jugador.usuario.nombre,
    codigoUniversitario: enrollment.jugador.codigoUniversitario,
    programa: enrollment.jugador.programa,
    semestre: enrollment.jugador.semestre,
    inscritoEn: enrollment.createdAt,
  }));
}
