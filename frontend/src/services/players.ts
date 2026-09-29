import type { PlayerSearchResultDto } from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api } from "./api";

export type PlayerSearchResult = Serialized<PlayerSearchResultDto>;

/** Searches players by name, email or university code. */
export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const { data } = await api.get<PlayerSearchResult[]>("/players", { params: { q: query } });
  return data;
}
