import { api } from "./api";

export interface TiebreakCriterion {
  name: string;
  order: number;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "CREATED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "IN_PROGRESS" | "FINISHED";
  format: string;
  roundsCount: number | null;
  timeControl: string | null;
  // Registration eligibility (see comment in backend/prisma/schema.prisma):
  // null = no restriction on that criterion.
  restrictedProgram: string | null;
  minimumSemester: number | null;
  // HU28: what a bye is worth (1, 0.5 or 0).
  byePoints: number;
  organizerId: string;
  tiebreakCriteria: TiebreakCriterion[];
  createdAt: string;
}

export interface CreateTournamentPayload {
  name: string;
  startDate: string;
  endDate: string;
  format?: string;
}

export interface ConfigureTournamentPayload {
  roundsCount?: number;
  timeControl?: string;
  tiebreakCriteria?: TiebreakCriterion[];
  // An explicit null clears the restriction; omitting the field leaves it as-is.
  restrictedProgram?: string | null;
  minimumSemester?: number | null;
  byePoints?: 0 | 0.5 | 1;
}

export interface EnrolledPlayer {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
  enrolledAt: string;
}

/** Lists the tournaments the current user organizes. */
export async function listMyTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/tournaments/mine");
  return data;
}

/** Lists tournaments currently open for registration. */
export async function listAvailableTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/tournaments/available");
  return data;
}

/** Lists tournaments the current user (as a player) is enrolled in. */
export async function listEnrolledTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/tournaments/enrolled");
  return data;
}

/** Creates a new tournament. */
export async function createTournament(payload: CreateTournamentPayload): Promise<Tournament> {
  const { data } = await api.post<Tournament>("/tournaments", payload);
  return data;
}

/** Fetches a single tournament by id. */
export async function getTournament(id: string): Promise<Tournament> {
  const { data } = await api.get<Tournament>(`/tournaments/${id}`);
  return data;
}

/** Updates a tournament's rounds, time control, tiebreak order and eligibility rules. */
export async function configureTournament(id: string, payload: ConfigureTournamentPayload): Promise<Tournament> {
  const { data } = await api.put<Tournament>(`/tournaments/${id}/configuration`, payload);
  return data;
}

/** Opens registration for a tournament (HU06). */
export async function openRegistration(id: string): Promise<Tournament> {
  const { data } = await api.post<Tournament>(`/tournaments/${id}/registration/open`);
  return data;
}

/** Closes registration for a tournament (HU06). */
export async function closeRegistration(id: string): Promise<Tournament> {
  const { data } = await api.post<Tournament>(`/tournaments/${id}/registration/close`);
  return data;
}

/** Enrolls a player into a tournament (HU07). */
export async function enrollPlayer(tournamentId: string, playerId: string): Promise<EnrolledPlayer> {
  const { data } = await api.post<EnrolledPlayer>(`/tournaments/${tournamentId}/players`, { playerId });
  return data;
}

/** Lists the players enrolled in a tournament. */
export async function listEnrolledPlayers(tournamentId: string): Promise<EnrolledPlayer[]> {
  const { data } = await api.get<EnrolledPlayer[]>(`/tournaments/${tournamentId}/players`);
  return data;
}

/** Withdraws a player from a tournament (HU27). */
export async function withdrawPlayer(tournamentId: string, playerId: string, reason?: string): Promise<void> {
  await api.post(`/tournaments/${tournamentId}/players/${playerId}/withdraw`, reason ? { reason } : {});
}

/** Lists tournaments in progress or finished, which anyone can follow (HU18). */
export async function listLiveTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/tournaments/live");
  return data;
}

/** Officially closes a tournament once all its rounds are recorded (HU17). */
export async function finishTournament(id: string): Promise<Tournament> {
  const { data } = await api.post<Tournament>(`/tournaments/${id}/finish`);
  return data;
}
