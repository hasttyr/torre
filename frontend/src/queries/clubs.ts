import { defineQueryOptions, type QueryCache } from "@pinia/colada";

import { listClubPlayers, listClubs, type Club, type ClubPlayer } from "../services/clubs";

// Clubs (HU23), cached with Pinia Colada: the list under ["clubs"] and each
// club's roster under ["club", id, "players"]. Picking club B reads B's
// roster entry, so a late answer for club A can never show under B.

export const clubsQuery = defineQueryOptions({
  key: ["clubs"],
  query: () => listClubs(),
});

export const clubPlayersQuery = defineQueryOptions((clubId: string) => ({
  key: ["club", clubId, "players"],
  query: () => listClubPlayers(clubId),
}));

/** Adds a just-created club to the list. */
export function addClub(cache: QueryCache, club: Club): void {
  cache.setQueryData(clubsQuery.key, (clubs = []) => [...clubs, club]);
}

/** Shows a club as the server answered a change to it (a rename). */
export function replaceClub(cache: QueryCache, club: Club): void {
  cache.setQueryData(clubsQuery.key, (clubs = []) => clubs.map((listed) => (listed.id === club.id ? club : listed)));
}

/** Takes a deleted club off the list. */
export function removeClub(cache: QueryCache, clubId: string): void {
  cache.setQueryData(clubsQuery.key, (clubs = []) => clubs.filter((club) => club.id !== clubId));
}

/**
 * Adds a just-assigned player to the club's roster. A player belongs to one
 * club at a time, so another club may have just lost them: the rosters not
 * on screen are read again when next shown.
 */
export function addToRoster(cache: QueryCache, clubId: string, player: ClubPlayer): void {
  cache.setQueryData(clubPlayersQuery(clubId).key, (players = []) => [...players, player]);
  cache.invalidateQueries({ key: ["club"], active: false }).catch(() => undefined);
}

/** Takes a player off the club's roster. */
export function removeFromRoster(cache: QueryCache, clubId: string, playerId: string): void {
  cache.setQueryData(clubPlayersQuery(clubId).key, (players = []) =>
    players.filter((player) => player.playerId !== playerId),
  );
}
