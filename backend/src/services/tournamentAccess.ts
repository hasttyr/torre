import type { Prisma, Tournament } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { AuthUser } from "../types/express";

// The single place that answers "may this user do X on this tournament?"
// and "does the tournament's state allow X?". Every service touching a
// tournament (registration, rounds, results, standings) asks here instead
// of re-deriving the rules.

type Db = Prisma.TransactionClient;

/**
 * Loads a tournament by id.
 *
 * @throws {HttpError} 404 if it doesn't exist.
 */
export async function loadTournament(db: Db, tournamentId: string): Promise<Tournament> {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    throw new HttpError(404, "Torneo no encontrado");
  }
  return tournament;
}

/** Whether the user manages the tournament: its organizer, or any administrator. */
export function canManageTournament(tournament: Pick<Tournament, "organizerId">, user: AuthUser): boolean {
  return user.role === "ADMINISTRATOR" || tournament.organizerId === user.id;
}

/** @throws {HttpError} 403 unless the user manages the tournament. */
export function assertCanManageTournament(tournament: Pick<Tournament, "organizerId">, user: AuthUser): void {
  if (!canManageTournament(tournament, user)) {
    throw new HttpError(403, "No tenés permiso para administrar este torneo");
  }
}

/**
 * HU18: a tournament's published information (rounds, results, standings)
 * is visible to every authenticated user once it leaves the preliminary
 * state — the same information printed at the venue. A CREATED draft is
 * only visible to whoever manages it.
 *
 * @throws {HttpError} 404 (not 403, so a draft's existence isn't revealed).
 */
export function assertCanViewTournament(tournament: Tournament, user: AuthUser): void {
  if (tournament.status === "CREATED" && !canManageTournament(tournament, user)) {
    throw new HttpError(404, "Torneo no encontrado");
  }
}

/**
 * The tournament's officials: any arbiter (there's no per-tournament arbiter
 * assignment), its organizer, or any administrator.
 */
export function isTournamentOfficial(tournament: Pick<Tournament, "organizerId">, user: AuthUser): boolean {
  return user.role === "ARBITER" || canManageTournament(tournament, user);
}

/**
 * RN-06: only an arbiter or an authorized organizer records or corrects results.
 *
 * @throws {HttpError} 403 otherwise.
 */
export function assertCanRecordResults(tournament: Pick<Tournament, "organizerId">, user: AuthUser): void {
  if (!isTournamentOfficial(tournament, user)) {
    throw new HttpError(403, "Solo un árbitro o el organizador del torneo pueden registrar resultados");
  }
}

/**
 * HU30: the official documents (standings, pairings) are exported by the
 * organizer or an arbiter, to post them at the venue.
 *
 * @throws {HttpError} 403 otherwise.
 */
export function assertCanExport(tournament: Pick<Tournament, "organizerId">, user: AuthUser): void {
  if (!isTournamentOfficial(tournament, user)) {
    throw new HttpError(403, "Solo un árbitro o el organizador del torneo pueden exportar sus documentos oficiales");
  }
}

/**
 * HU17: once finished, a tournament rejects any operation that would change
 * its competitive record.
 *
 * @throws {HttpError} 409 if the tournament is FINISHED.
 */
export function assertNotFinished(tournament: Pick<Tournament, "status">): void {
  if (tournament.status === "FINISHED") {
    throw new HttpError(409, "El torneo ya finalizó: no admite más cambios");
  }
}
