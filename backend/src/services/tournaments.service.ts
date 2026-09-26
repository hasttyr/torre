import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type {
  ConfigureTournamentSchemaInput,
  CreateTournamentSchemaInput,
  WithdrawPlayerSchemaInput,
} from "../validators/tournaments.schemas";
import { emitToTournament } from "../sockets/broadcast";
import { SOCKET_EVENTS } from "../sockets/events";
import type { AuthUser } from "../types/express";
import { recordAuditLog } from "./auditLog.service";
import { isUniqueConstraintError } from "./prismaErrors";
import { toTournamentDto, type TournamentDto } from "./tournament.mapper";
import {
  assertCanManageTournament as assertCanManage,
  assertCanViewTournament,
  assertNotFinished,
  loadTournament,
} from "./tournamentAccess";

// Adapter so this file's (userId, role) signatures stay as they were; the
// rule itself lives in tournamentAccess.ts.
function assertCanManageTournament(tournament: { organizerId: string }, userId: string, role: string): void {
  assertCanManage(tournament, { id: userId, role });
}

/** Creates a new tournament owned by `organizerId`. */
export async function createTournament(
  prisma: PrismaClient,
  organizerId: string,
  data: CreateTournamentSchemaInput,
): Promise<TournamentDto> {
  const tournament = await prisma.tournament.create({
    data: {
      name: data.name.trim(),
      startDate: data.startDate,
      endDate: data.endDate,
      format: data.format?.trim() ?? "swiss",
      organizerId,
    },
    include: { tiebreakCriteria: true },
  });

  return toTournamentDto(tournament);
}

// HU26 (pulled forward from S11 to S6, together with Enrollment): without
// this there's no way to find a tournament already created from the UI
// short of saving the link by hand. An organizer sees only their own; an
// administrator sees all (same rule as assertCanManageTournament).
/** Lists the tournaments the given user organizes (or all of them, for an admin). */
export async function listMyTournaments(prisma: PrismaClient, userId: string, role: string): Promise<TournamentDto[]> {
  const tournaments = await prisma.tournament.findMany({
    where: role === "ADMINISTRATOR" ? {} : { organizerId: userId },
    include: { tiebreakCriteria: true },
    orderBy: { createdAt: "desc" },
  });
  return tournaments.map(toTournamentDto);
}

// HU25 (pulled forward from S11 to S6): the listing a player sees to decide
// which tournament to register for. Only REGISTRATION_OPEN counts as
// "available" (CA: "a finished or private tournament doesn't show up");
// CREATED doesn't accept registrations yet either, so it isn't listed.
/** Lists tournaments currently open for registration. */
export async function listAvailableTournaments(prisma: PrismaClient): Promise<TournamentDto[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { status: "REGISTRATION_OPEN" },
    include: { tiebreakCriteria: true },
    orderBy: { startDate: "asc" },
  });
  return tournaments.map(toTournamentDto);
}

// Tournaments where the authenticated user is enrolled as a player,
// regardless of who made the enrollment (today always the organizer, see
// HU07). A user without a Player profile (e.g. ORGANIZER role) simply
// has no enrollments.
/** Lists tournaments the given user (as a player) is enrolled in. */
export async function listEnrolledTournaments(prisma: PrismaClient, userId: string): Promise<TournamentDto[]> {
  const player = await prisma.player.findUnique({ where: { userId } });
  if (!player) {
    return [];
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { playerId: player.id },
    include: { tournament: { include: { tiebreakCriteria: true } } },
    orderBy: { createdAt: "desc" },
  });

  return enrollments.map((enrollment) => toTournamentDto(enrollment.tournament));
}

// HU18: a tournament's detail carries no personal data, so any
// authenticated user can read it once it's past the preliminary state (see
// assertCanViewTournament). The HU07 roster (listEnrolledPlayers) does
// expose personal data and stays restricted to whoever manages it.
/**
 * Fetches a single tournament by id.
 *
 * @throws {HttpError} 404 if it doesn't exist or is a draft the user can't see.
 */
export async function getTournament(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  role: string,
): Promise<TournamentDto> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { tiebreakCriteria: true },
  });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanViewTournament(tournament, { id: userId, role });
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
  role: string,
  data: ConfigureTournamentSchemaInput,
): Promise<TournamentDto> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, role);
  assertNotFinished(tournament);

  if (data.roundsCount !== undefined) {
    // A tournament can't be configured for fewer rounds than it already has:
    // it would never meet its own closing condition (HU17) consistently.
    const existingRounds = await prisma.round.count({ where: { tournamentId } });
    if (data.roundsCount < existingRounds) {
      throw new HttpError(
        409,
        `El torneo ya tiene ${existingRounds} rondas generadas: no puede configurarse con menos`,
      );
    }
  }

  if (data.tiebreakCriteria || data.byePoints !== undefined) {
    // RN-05: the tiebreak order can only be changed while the tournament is
    // in its preliminary state, i.e. before round 1 exists. Bye points
    // (HU28) follow the same rule: changing them mid-tournament would
    // silently rewrite scores already published.
    const firstRound = await prisma.round.findFirst({ where: { tournamentId, number: 1 } });
    if (firstRound) {
      throw new HttpError(
        409,
        "No se pueden modificar los desempates ni los puntos del bye después de iniciada la primera ronda",
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.tiebreakCriteria) {
      await tx.tiebreakCriterion.deleteMany({ where: { tournamentId } });
      if (data.tiebreakCriteria.length > 0) {
        await tx.tiebreakCriterion.createMany({
          data: data.tiebreakCriteria.map((criterion) => ({
            tournamentId,
            name: criterion.name,
            order: criterion.order,
          })),
        });
      }
    }

    return tx.tournament.update({
      where: { id: tournamentId },
      data: {
        ...(data.roundsCount !== undefined ? { roundsCount: data.roundsCount } : {}),
        ...(data.timeControl !== undefined ? { timeControl: data.timeControl } : {}),
        ...(data.restrictedProgram !== undefined ? { restrictedProgram: data.restrictedProgram } : {}),
        ...(data.minimumSemester !== undefined ? { minimumSemester: data.minimumSemester } : {}),
        ...(data.byePoints !== undefined ? { byePoints: data.byePoints } : {}),
      },
      include: { tiebreakCriteria: true },
    });
  });

  return toTournamentDto(updated);
}

const REGISTRATION_TRANSITIONS = {
  open: { from: "CREATED", to: "REGISTRATION_OPEN" },
  close: { from: "REGISTRATION_OPEN", to: "REGISTRATION_CLOSED" },
} as const;

/** Moves a tournament's registration status through one of the allowed transitions. */
async function transitionRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  role: string,
  action: keyof typeof REGISTRATION_TRANSITIONS,
): Promise<TournamentDto> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, role);

  const { from, to } = REGISTRATION_TRANSITIONS[action];
  if (tournament.status !== from) {
    throw new HttpError(409, `No se puede pasar de "${tournament.status}" a "${to}": se requiere estado "${from}"`);
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: to },
    include: { tiebreakCriteria: true },
  });

  return toTournamentDto(updated);
}

/** Opens registration for a tournament (HU06). */
export function openRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  role: string,
): Promise<TournamentDto> {
  return transitionRegistration(prisma, tournamentId, userId, role, "open");
}

/** Closes registration for a tournament (HU06). */
export function closeRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string,
  role: string,
): Promise<TournamentDto> {
  return transitionRegistration(prisma, tournamentId, userId, role, "close");
}

export interface EnrolledPlayerDto {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
  enrolledAt: Date;
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
  playerId: string,
  userId: string,
  role: string,
): Promise<EnrolledPlayerDto> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, role);

  // CA HU06: once registration is closed, new enrollments are rejected.
  if (tournament.status !== "REGISTRATION_OPEN") {
    throw new HttpError(409, "El torneo no tiene las inscripciones abiertas");
  }

  const player = await prisma.player.findUnique({ where: { id: playerId }, include: { user: true } });
  if (!player) {
    throw new HttpError(404, "Jugador no encontrado");
  }

  // Eligibility configured in HU05 (restrictedProgram/minimumSemester): validated
  // here, not in the zod schema, because it depends on tournament and player
  // data, not just the payload's shape.
  if (tournament.restrictedProgram && player.program !== tournament.restrictedProgram) {
    throw new HttpError(409, `Este torneo solo admite jugadores del programa "${tournament.restrictedProgram}"`);
  }
  if (tournament.minimumSemester != null && player.semester < tournament.minimumSemester) {
    throw new HttpError(409, `Este torneo exige un semestre mínimo de ${tournament.minimumSemester}`);
  }

  try {
    const enrollment = await prisma.enrollment.create({
      data: { tournamentId, playerId },
    });
    return {
      playerId: player.id,
      name: player.user.name,
      universityCode: player.universityCode,
      program: player.program,
      semester: player.semester,
      enrolledAt: enrollment.createdAt,
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
  role: string,
): Promise<EnrolledPlayerDto[]> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, role);

  const enrollments = await prisma.enrollment.findMany({
    // HU27: a withdrawn player isn't part of the active roster anymore.
    where: { tournamentId, withdrawnAt: null },
    include: { player: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  return enrollments.map((enrollment) => ({
    playerId: enrollment.player.id,
    name: enrollment.player.user.name,
    universityCode: enrollment.player.universityCode,
    program: enrollment.player.program,
    semester: enrollment.player.semester,
    enrolledAt: enrollment.createdAt,
  }));
}

/**
 * Withdraws a player from a tournament (HU27): their enrollment is kept for
 * history but excluded from the active roster and future pairings.
 *
 * @throws {HttpError} 404 if the tournament doesn't exist or the player
 * isn't (actively) enrolled, 403 if not allowed to manage the tournament.
 */
export async function withdrawPlayer(
  prisma: PrismaClient,
  tournamentId: string,
  playerId: string,
  userId: string,
  role: string,
  data: WithdrawPlayerSchemaInput,
): Promise<void> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  assertCanManageTournament(tournament, userId, role);
  assertNotFinished(tournament);

  const enrollment = await prisma.enrollment.findUnique({
    where: { tournamentId_playerId: { tournamentId, playerId } },
    include: { player: { include: { user: true } } },
  });
  if (!enrollment || enrollment.withdrawnAt) {
    throw new HttpError(404, "El jugador no está inscrito activamente en este torneo");
  }

  // RN-11: a player withdrawal is a critical administrative action.
  const reasonSuffix = data.reason ? ` — ${data.reason}` : "";
  const detail = `${enrollment.player.user.name} de "${tournament.name}"${reasonSuffix}`;
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { withdrawnAt: new Date() } });
    await recordAuditLog(tx, userId, "PLAYER_WITHDRAWN", detail);
  });
}

// HU18: where players, coaches and arbiters find tournaments to follow: the
// ones being played and the ones already played (their results stay
// consultable). In-progress ones first, then the most recent.
/** Lists tournaments in progress or finished, visible to every authenticated user. */
export async function listLiveTournaments(prisma: PrismaClient): Promise<TournamentDto[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["IN_PROGRESS", "FINISHED"] } },
    include: { tiebreakCriteria: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  return tournaments.map(toTournamentDto);
}

/**
 * HU17: officially closes a tournament once every configured round has been
 * played and fully recorded. From then on assertNotFinished rejects any
 * change to its competitive record.
 *
 * @throws {HttpError} 404/403 as usual, 409 if the closing conditions aren't met.
 */
export async function finishTournament(
  prisma: PrismaClient,
  tournamentId: string,
  actor: AuthUser,
): Promise<TournamentDto> {
  const tournament = await loadTournament(prisma, tournamentId);
  assertCanManage(tournament, actor);
  if (tournament.status !== "IN_PROGRESS") {
    throw new HttpError(409, "Solo se puede finalizar un torneo en curso");
  }

  const rounds = await prisma.round.findMany({ where: { tournamentId }, select: { status: true } });
  const completed = rounds.filter((round) => round.status === "STANDINGS_UPDATED").length;
  if (completed !== rounds.length || completed < (tournament.roundsCount ?? 0)) {
    throw new HttpError(
      409,
      `Para finalizar deben estar jugadas y registradas las ${tournament.roundsCount} rondas (completas: ${completed})`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const finished = await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "FINISHED" },
      include: { tiebreakCriteria: true },
    });
    await recordAuditLog(tx, actor.id, "TOURNAMENT_FINISHED", `"${tournament.name}"`);
    return finished;
  });
  emitToTournament(tournamentId, SOCKET_EVENTS.TOURNAMENT_FINISHED, { tournamentId });

  return toTournamentDto(updated);
}
