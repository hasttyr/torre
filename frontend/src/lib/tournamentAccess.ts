import type { Tournament } from "../services/tournaments";

// Mirrors backend/src/services/tournamentAccess.ts, only to decide which
// controls to show: the backend enforces the same rules on every request.

interface Viewer {
  id: string;
  role: string;
}

/** Its organizer, or any administrator. */
export function canManageTournament(tournament: Pick<Tournament, "organizerId">, viewer: Viewer | null): boolean {
  return viewer !== null && (viewer.role === "ADMINISTRATOR" || tournament.organizerId === viewer.id);
}

/** The tournament's officials: any arbiter, or whoever manages it. */
export function isTournamentOfficial(tournament: Pick<Tournament, "organizerId">, viewer: Viewer | null): boolean {
  return viewer !== null && (viewer.role === "ARBITER" || canManageTournament(tournament, viewer));
}

/** RN-06: its officials record results; never once it's finished (HU17). */
export function canRecordResults(
  tournament: Pick<Tournament, "organizerId" | "status">,
  viewer: Viewer | null,
): boolean {
  return tournament.status !== "FINISHED" && isTournamentOfficial(tournament, viewer);
}

/** HU30: its officials export the official documents, also after it finished. */
export function canExportDocuments(tournament: Pick<Tournament, "organizerId">, viewer: Viewer | null): boolean {
  return isTournamentOfficial(tournament, viewer);
}

/** HU18: once play has started, a tournament has a room to follow (pairings, results, standings). */
export function hasTournamentRoom(tournament: Pick<Tournament, "status">): boolean {
  return tournament.status === "IN_PROGRESS" || tournament.status === "FINISHED";
}
