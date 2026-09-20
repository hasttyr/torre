import { api } from "./api";

export interface Club {
  id: string;
  name: string;
  createdAt: string;
}

export interface ClubPlayer {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
}

/** Lists all clubs. */
export async function listClubs(): Promise<Club[]> {
  const { data } = await api.get<Club[]>("/clubs");
  return data;
}

/** Creates a new club (HU23). */
export async function createClub(name: string): Promise<Club> {
  const { data } = await api.post<Club>("/clubs", { name });
  return data;
}

/** Renames a club (HU23). */
export async function updateClub(id: string, name: string): Promise<Club> {
  const { data } = await api.put<Club>(`/clubs/${id}`, { name });
  return data;
}

/** Deletes a club (must have no players assigned). */
export async function deleteClub(id: string): Promise<void> {
  await api.delete(`/clubs/${id}`);
}

/** Lists the players belonging to a club. */
export async function listClubPlayers(id: string): Promise<ClubPlayer[]> {
  const { data } = await api.get<ClubPlayer[]>(`/clubs/${id}/players`);
  return data;
}

/** Associates a player with a club (HU23). */
export async function assignPlayerToClub(clubId: string, playerId: string): Promise<ClubPlayer> {
  const { data } = await api.post<ClubPlayer>(`/clubs/${clubId}/players`, { playerId });
  return data;
}

/** Removes a player from a club (HU23). */
export async function removePlayerFromClub(clubId: string, playerId: string): Promise<void> {
  await api.delete(`/clubs/${clubId}/players/${playerId}`);
}
