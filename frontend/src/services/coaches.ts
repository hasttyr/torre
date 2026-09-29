import type { CoachTournamentDto, CoachTournamentPlayerDto, LinkedPlayerDto } from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api, path } from "./api";

export type LinkedPlayer = Serialized<LinkedPlayerDto>;
export type CoachTournamentPlayer = Serialized<CoachTournamentPlayerDto>;
export type CoachTournament = Serialized<CoachTournamentDto>;

/** Lists the players the current coach follows or has asked to follow (HU24). */
export async function listLinkedPlayers(): Promise<LinkedPlayer[]> {
  const { data } = await api.get<LinkedPlayer[]>("/coaches/players");
  return data;
}

/** Asks to follow a player (HU24): a request until the player accepts it. */
export async function linkPlayer(playerId: string): Promise<LinkedPlayer> {
  const { data } = await api.post<LinkedPlayer>("/coaches/players", { playerId });
  return data;
}

/** Stops following a player, or cancels the request (HU24). */
export async function unlinkPlayer(playerId: string): Promise<void> {
  await api.delete(path`/coaches/players/${playerId}`);
}

/** Lists the tournaments where at least one of the coach's linked players is enrolled. */
export async function listCoachTournaments(): Promise<CoachTournament[]> {
  const { data } = await api.get<CoachTournament[]>("/coaches/tournaments");
  return data;
}
