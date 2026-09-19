import { api } from "./api";

export interface TiebreakCriterion {
  nombre: string;
  orden: number;
}

export interface Tournament {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "CREADO" | "INSCRIPCIONES_ABIERTAS" | "INSCRIPCIONES_CERRADAS" | "EN_CURSO" | "FINALIZADO";
  formato: string;
  numeroRondas: number | null;
  ritmo: string | null;
  // Registration eligibility (see comment in backend/prisma/schema.prisma):
  // null = no restriction on that criterion.
  programaRestringido: string | null;
  semestreMinimo: number | null;
  organizadorId: string;
  criteriosDesempate: TiebreakCriterion[];
  createdAt: string;
}

export interface CreateTournamentPayload {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  formato?: string;
}

export interface ConfigureTournamentPayload {
  numeroRondas?: number;
  ritmo?: string;
  criteriosDesempate?: TiebreakCriterion[];
  // An explicit null clears the restriction; omitting the field leaves it as-is.
  programaRestringido?: string | null;
  semestreMinimo?: number | null;
}

export interface EnrolledPlayer {
  jugadorId: string;
  nombre: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  inscritoEn: string;
}

/** Lists the tournaments the current user organizes. */
export async function listMyTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/torneos/mios");
  return data;
}

/** Lists tournaments currently open for registration. */
export async function listAvailableTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/torneos/disponibles");
  return data;
}

/** Lists tournaments the current user (as a player) is enrolled in. */
export async function listEnrolledTournaments(): Promise<Tournament[]> {
  const { data } = await api.get<Tournament[]>("/torneos/inscrito");
  return data;
}

/** Creates a new tournament. */
export async function createTournament(payload: CreateTournamentPayload): Promise<Tournament> {
  const { data } = await api.post<Tournament>("/torneos", payload);
  return data;
}

/** Fetches a single tournament by id. */
export async function getTournament(id: string): Promise<Tournament> {
  const { data } = await api.get<Tournament>(`/torneos/${id}`);
  return data;
}

/** Updates a tournament's rounds, time control, tiebreak order and eligibility rules. */
export async function configureTournament(id: string, payload: ConfigureTournamentPayload): Promise<Tournament> {
  const { data } = await api.put<Tournament>(`/torneos/${id}/configuracion`, payload);
  return data;
}

/** Opens registration for a tournament (HU06). */
export async function openRegistration(id: string): Promise<Tournament> {
  const { data } = await api.post<Tournament>(`/torneos/${id}/inscripciones/abrir`);
  return data;
}

/** Closes registration for a tournament (HU06). */
export async function closeRegistration(id: string): Promise<Tournament> {
  const { data } = await api.post<Tournament>(`/torneos/${id}/inscripciones/cerrar`);
  return data;
}

/** Enrolls a player into a tournament (HU07). */
export async function enrollPlayer(tournamentId: string, playerId: string): Promise<EnrolledPlayer> {
  const { data } = await api.post<EnrolledPlayer>(`/torneos/${tournamentId}/jugadores`, { jugadorId: playerId });
  return data;
}

/** Lists the players enrolled in a tournament. */
export async function listEnrolledPlayers(tournamentId: string): Promise<EnrolledPlayer[]> {
  const { data } = await api.get<EnrolledPlayer[]>(`/torneos/${tournamentId}/jugadores`);
  return data;
}
