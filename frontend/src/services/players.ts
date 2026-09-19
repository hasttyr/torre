import { api } from "./api";

export interface PlayerSearchResult {
  id: string;
  name: string;
  email: string;
  universityCode: string;
  program: string;
  semester: number;
}

/** Searches players by name, email or university code. */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const { data } = await api.get<PlayerSearchResult[]>("/players", { params: { q: query } });
  return data;
}
