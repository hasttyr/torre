import type { PrismaClient } from "../generated/prisma/client";

import { HttpError } from "../errors/apiErrors";
import type {
  ConfigureTournamentSchemaInput,
  CreateTournamentSchemaInput,
  WithdrawPlayerSchemaInput,
} from "../validators/tournaments.schemas";
import { emitToTournament } from "../sockets/broadcast";
import { SOCKET_EVENTS } from "../sockets/events";
import type { AuthUser } from "../types/express";
import { mention, recordAuditLog } from "./auditLog.service";
import { completeBlockedSuppressions } from "./dataRights.service";
import { toTournamentDto, type TournamentDto } from "./tournament.mapper";
import {
  assertCanManageTournament,
  assertCanViewTournament,
  assertNotFinished,
  loadTournament,
  lockTournament,
} from "./tournamentAccess";
import type { EnrolledPlayerDto } from "../contracts/responses";

const WITH_CRITERIA = { tiebreakCriteria: true } as const;

/** Creates a new tournament owned by the actor. */
export async function createTournament(
  prisma: PrismaClient,
  data: CreateTournamentSchemaInput,
  actor: AuthUser,
): Promise<TournamentDto> {
  const tournament = await prisma.tournament.create({
    data: {
      name: data.name.trim(),
      startDate: data.startDate,
      endDate: data.endDate,
      format: data.format?.trim() ?? "swiss",
      organizerId: actor.id,
    },
    include: WITH_CRITERIA,
  });

  return toTournamentDto(tournament);
}

// HU26 (pulled forward from S11 to S6, together with Enrollment): without
// this there's no way to find a tournament already created from the UI
// short of saving the link by hand. An organizer sees only their own; an
// administrator sees all (same rule as assertCanManageTournament).
/** Lists the tournaments the actor organizes (or all of them, for an admin). */
export async function listMyTournaments(prisma: PrismaClient, actor: AuthUser): Promise<TournamentDto[]> {
  const tournaments = await prisma.tournament.findMany({
    where: actor.role === "ADMINISTRATOR" ? {} : { organizerId: actor.id },
    include: WITH_CRITERIA,
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
    include: WITH_CRITERIA,
    orderBy: { startDate: "asc" },
  });
  return tournaments.map(toTournamentDto);
}

// Tournaments where the authenticated user is enrolled as a player,
// regardless of who made the enrollment (today always the organizer, see
// HU07). A user without a Player profile (e.g. ORGANIZER role) simply
// has no enrollments.
/** Lists tournaments the actor (as a player) is enrolled in. */
export async function listEnrolledTournaments(prisma: PrismaClient, actor: AuthUser): Promise<TournamentDto[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { player: { userId: actor.id } },
    include: { tournament: { include: WITH_CRITERIA } },
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
 * @throws {HttpError} 404 if it doesn't exist or is a draft the actor can't see.
 */
export async function getTournament(
  prisma: PrismaClient,
  tournamentId: string,
  actor: AuthUser,
): Promise<TournamentDto> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: WITH_CRITERIA });
  if (!tournament) {
    throw new HttpError("TOURNAMENT_NOT_FOUND");
  }
  assertCanViewTournament(tournament, actor);
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
  data: ConfigureTournamentSchemaInput,
  actor: AuthUser,
): Promise<TournamentDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertCanManageTournament(tournament, actor);
    assertNotFinished(tournament);

    if (data.roundsCount !== undefined) {
      // A tournament can't be configured for fewer rounds than it already has:
      // it would never meet its own closing condition (HU17) consistently.
      const existingRounds = await tx.round.count({ where: { tournamentId } });
      if (data.roundsCount < existingRounds) {
        throw new HttpError("ROUNDS_BELOW_GENERATED", { count: existingRounds });
      }
    }

    if (data.tiebreakCriteria || data.byePoints !== undefined) {
      // RN-05: the tiebreak order can only be changed while the tournament is
      // in its preliminary state, i.e. before round 1 exists. Bye points
      // (HU28) follow the same rule: changing them mid-tournament would
      // silently rewrite scores already published.
      const firstRound = await tx.round.findFirst({ where: { tournamentId, number: 1 } });
      if (firstRound) {
        throw new HttpError("TIEBREAKS_LOCKED");
      }
    }

    if (data.tiebreakCriteria) {
      await tx.tiebreakCriterion.deleteMany({ where: { tournamentId } });
      if (data.tiebreakCriteria.length > 0) {
        await tx.tiebreakCriterion.createMany({
          data: data.tiebreakCriteria.map(({ name, order }) => ({ tournamentId, name, order })),
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
      include: WITH_CRITERIA,
    });
  });

  return toTournamentDto(updated);
}

const REGISTRATION_TRANSITIONS = {
  open: { from: "CREATED", to: "REGISTRATION_OPEN", refused: "REGISTRATION_CANNOT_OPEN" },
  close: { from: "REGISTRATION_OPEN", to: "REGISTRATION_CLOSED", refused: "REGISTRATION_CANNOT_CLOSE" },
} as const;

/** Moves a tournament's registration status through one of the allowed transitions. */
async function transitionRegistration(
  prisma: PrismaClient,
  tournamentId: string,
  action: keyof typeof REGISTRATION_TRANSITIONS,
  actor: AuthUser,
): Promise<TournamentDto> {
  const { from, to, refused } = REGISTRATION_TRANSITIONS[action];
  const updated = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertCanManageTournament(tournament, actor);
    if (tournament.status !== from) {
      throw new HttpError(refused);
    }
    return tx.tournament.update({ where: { id: tournamentId }, data: { status: to }, include: WITH_CRITERIA });
  });

  return toTournamentDto(updated);
}

/** Opens registration for a tournament (HU06). */
export function openRegistration(prisma: PrismaClient, tournamentId: string, actor: AuthUser): Promise<TournamentDto> {
  return transitionRegistration(prisma, tournamentId, "open", actor);
}

/** Closes registration for a tournament (HU06). */
export function closeRegistration(prisma: PrismaClient, tournamentId: string, actor: AuthUser): Promise<TournamentDto> {
  return transitionRegistration(prisma, tournamentId, "close", actor);
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
  actor: AuthUser,
): Promise<EnrolledPlayerDto> {
  return prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertCanManageTournament(tournament, actor);

    // CA HU06: once registration is closed, new enrollments are rejected.
    if (tournament.status !== "REGISTRATION_OPEN") {
      throw new HttpError("REGISTRATION_NOT_OPEN");
    }

    const player = await tx.player.findUnique({ where: { id: playerId }, include: { user: true } });
    if (!player) {
      throw new HttpError("PLAYER_NOT_FOUND");
    }

    // Eligibility configured in HU05 (restrictedProgram/minimumSemester): validated
    // here, not in the zod schema, because it depends on tournament and player
    // data, not just the payload's shape.
    if (tournament.restrictedProgram && player.program !== tournament.restrictedProgram) {
      throw new HttpError("PROGRAM_NOT_ELIGIBLE", { program: tournament.restrictedProgram });
    }
    if (tournament.minimumSemester != null && player.semester < tournament.minimumSemester) {
      throw new HttpError("SEMESTER_NOT_ELIGIBLE", { semester: tournament.minimumSemester });
    }

    // RN-01: a player cannot be enrolled twice into the same tournament.
    const existing = await tx.enrollment.findUnique({ where: { tournamentId_playerId: { tournamentId, playerId } } });
    if (existing) {
      throw new HttpError("ALREADY_ENROLLED");
    }

    const enrollment = await tx.enrollment.create({ data: { tournamentId, playerId } });
    return {
      playerId: player.id,
      name: player.user.name,
      universityCode: player.universityCode,
      program: player.program,
      semester: player.semester,
      enrolledAt: enrollment.createdAt,
    };
  });
}

/** Lists the players enrolled in a tournament. */
export async function listEnrolledPlayers(
  prisma: PrismaClient,
  tournamentId: string,
  actor: AuthUser,
): Promise<EnrolledPlayerDto[]> {
  const tournament = await loadTournament(prisma, tournamentId);
  assertCanManageTournament(tournament, actor);

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
 * history but excluded from the active roster and future pairings. Whoever
 * follows the tournament's room sees it in the standings and stats.
 *
 * @throws {HttpError} 404 if the tournament doesn't exist or the player
 * isn't (actively) enrolled, 403 if not allowed to manage the tournament.
 */
export async function withdrawPlayer(
  prisma: PrismaClient,
  tournamentId: string,
  playerId: string,
  data: WithdrawPlayerSchemaInput,
  actor: AuthUser,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertCanManageTournament(tournament, actor);
    assertNotFinished(tournament);

    const enrollment = await tx.enrollment.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      include: { player: { select: { userId: true } } },
    });
    if (!enrollment || enrollment.withdrawnAt) {
      throw new HttpError("NOT_ACTIVELY_ENROLLED");
    }

    await tx.enrollment.update({ where: { id: enrollment.id }, data: { withdrawnAt: new Date() } });
    // RN-11: a player withdrawal is a critical administrative action.
    const reasonSuffix = data.reason ? ` — ${data.reason}` : "";
    await recordAuditLog(
      tx,
      actor.id,
      "PLAYER_WITHDRAWN",
      `${mention(enrollment.player.userId)} de "${tournament.name}"${reasonSuffix}`,
    );
  });
  emitToTournament(tournamentId, SOCKET_EVENTS.PLAYER_WITHDRAWN, { tournamentId, playerId });
}

// HU18: where players, coaches and arbiters find tournaments to follow: the
// ones being played and the ones already played (their results stay
// consultable). In-progress ones first, then the most recent.
/** Lists tournaments in progress or finished, visible to every authenticated user. */
export async function listLiveTournaments(prisma: PrismaClient): Promise<TournamentDto[]> {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["IN_PROGRESS", "FINISHED"] } },
    include: WITH_CRITERIA,
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
  const updated = await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertCanManageTournament(tournament, actor);
    if (tournament.status !== "IN_PROGRESS") {
      throw new HttpError("TOURNAMENT_NOT_IN_PROGRESS");
    }

    const rounds = await tx.round.findMany({ where: { tournamentId }, select: { status: true } });
    const completed = rounds.filter((round) => round.status === "STANDINGS_UPDATED").length;
    if (completed !== rounds.length || completed < (tournament.roundsCount ?? 0)) {
      throw new HttpError("ROUNDS_INCOMPLETE", { total: tournament.roundsCount ?? 0, completed });
    }

    const finished = await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "FINISHED" },
      include: WITH_CRITERIA,
    });
    await recordAuditLog(tx, actor.id, "TOURNAMENT_FINISHED", `"${tournament.name}"`);
    // HU22: whoever asked to be erased while this tournament ran can be now.
    await completeBlockedSuppressions(tx, tournamentId);
    return finished;
  });
  emitToTournament(tournamentId, SOCKET_EVENTS.TOURNAMENT_FINISHED, { tournamentId });

  return toTournamentDto(updated);
}

export type { EnrolledPlayerDto };
