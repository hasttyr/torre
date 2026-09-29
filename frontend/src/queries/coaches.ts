import { defineQueryOptions, type QueryCache } from "@pinia/colada";

import { listCoachTournaments, listLinkedPlayers, type LinkedPlayer } from "../services/coaches";

// The signed-in coach's side of HU24, cached with Pinia Colada.

export const linkedPlayersQuery = defineQueryOptions({
  key: ["coach", "players"],
  query: () => listLinkedPlayers(),
});

/** Tournaments where a player who accepted the coach is enrolled. */
export const coachTournamentsQuery = defineQueryOptions({
  key: ["coach", "tournaments"],
  query: () => listCoachTournaments(),
});

/** Adds a just-sent request to the coach's players; it's pending until the player accepts. */
export function addLinkedPlayer(cache: QueryCache, player: LinkedPlayer): void {
  cache.setQueryData(linkedPlayersQuery.key, (players = []) => [...players, player]);
}

/** Takes a player off the coach's list, and the tournaments only they played in off the coach's tournaments. */
export function removeLinkedPlayer(cache: QueryCache, playerId: string): void {
  cache.setQueryData(linkedPlayersQuery.key, (players = []) =>
    players.filter((player) => player.playerId !== playerId),
  );
  cache.invalidateQueries({ key: coachTournamentsQuery.key }).catch(() => undefined);
}
