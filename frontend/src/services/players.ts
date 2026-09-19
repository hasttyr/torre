import { api } from "./api";

export interface PlayerSearchResult {
  id: string;
  nombre: string;
  email: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

/** Searches players by name, email or university code. */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const { data } = await api.get<PlayerSearchResult[]>("/jugadores", { params: { q: query } });
  return data;
}
