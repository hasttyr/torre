import { api } from "./api";

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
