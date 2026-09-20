import { api } from "./api";
import type { Tournament } from "./tournaments";

export interface LinkedPlayer {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
  linkedAt: string;
}

/** Lists the players the current coach is linked to (HU24). */
export async function listLinkedPlayers(): Promise<LinkedPlayer[]> {
  const { data } = await api.get<LinkedPlayer[]>("/coaches/players");
  return data;
}

/** Links the current coach to a player (HU24). */
export async function linkPlayer(playerId: string): Promise<LinkedPlayer> {
  const { data } = await api.post<LinkedPlayer>("/coaches/players", { playerId });
  return data;
}

/** Unlinks a player from the current coach (HU24). */
export async function unlinkPlayer(playerId: string): Promise<void> {
  await api.delete(`/coaches/players/${playerId}`);
}

export interface CoachTournamentPlayer {
  playerId: string;
  name: string;
}

export interface CoachTournament extends Tournament {
  // Only the coach's own linked players enrolled in this tournament.
  myPlayers: CoachTournamentPlayer[];
}

/** Lists the tournaments where at least one of the coach's linked players is enrolled. */
export async function listCoachTournaments(): Promise<CoachTournament[]> {
  const { data } = await api.get<CoachTournament[]>("/coaches/tournaments");
  return data;
}
