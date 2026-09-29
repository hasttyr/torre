import type { Prisma, Tournament } from "../generated/prisma/client";

import { HttpError } from "../errors/apiErrors";
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
    throw new HttpError("TOURNAMENT_NOT_FOUND");
  }
  return tournament;
}

/**
 * Locks the tournament's row until the transaction ends, and loads it as it
 * is now. Every change to a tournament's state or competitive record
 * (registration, configuration, rounds, results, finishing) starts here and
 * checks its rules after it: two changes to one tournament never interleave,
 * so none acts on a state another has just changed (a result recorded into a
 * tournament that just finished, two standings rebuilds losing a result).
 * Changes to different tournaments don't wait on each other.
 *
 * @throws {HttpError} 404 if it doesn't exist.
 */
export async function lockTournament(tx: Db, tournamentId: string): Promise<Tournament> {
  await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId} FOR UPDATE`;
  return loadTournament(tx, tournamentId);
}

/** Whether the user manages the tournament: its organizer, or any administrator. */
export function canManageTournament(tournament: Pick<Tournament, "organizerId">, user: AuthUser): boolean {
  return user.role === "ADMINISTRATOR" || tournament.organizerId === user.id;
}

/** @throws {HttpError} 403 unless the user manages the tournament. */
export function assertCanManageTournament(tournament: Pick<Tournament, "organizerId">, user: AuthUser): void {
  if (!canManageTournament(tournament, user)) {
    throw new HttpError("TOURNAMENT_FORBIDDEN");
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
    throw new HttpError("TOURNAMENT_NOT_FOUND");
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
    throw new HttpError("RESULTS_FORBIDDEN");
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
    throw new HttpError("EXPORT_FORBIDDEN");
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
    throw new HttpError("TOURNAMENT_FINISHED");
  }
}
