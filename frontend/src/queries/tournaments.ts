import { defineQueryOptions, type QueryCache } from "@pinia/colada";

import { getStandings, getTournamentStats, listRounds } from "../services/rounds";
import {
  getTournament,
  listAvailableTournaments,
  listEnrolledPlayers,
  listEnrolledTournaments,
  listLiveTournaments,
  listMyTournaments,
  type EnrolledPlayer,
  type Tournament,
} from "../services/tournaments";
import { prefetchQuery } from "./prefetch";

// Tournament data, cached with Pinia Colada. Everything about one tournament
// sits under ["tournament", id] (its header, roster, rounds, standings and
// statistics), so one invalidation refreshes all of it; the lists of
// tournaments sit under ["tournaments"]. A page asking for tournament B
// reads B's entries: a late answer about A can't land on B's page.

const LISTS = ["tournaments"] as const;
const tournamentKey = (id: string) => ["tournament", id] as const;

/** Tournaments in play or played, for anyone to follow (HU18). */
export const liveTournamentsQuery = defineQueryOptions({
  key: [...LISTS, "live"],
  query: () => listLiveTournaments(),
});

/** The tournaments the signed-in organizer runs. */
export const myTournamentsQuery = defineQueryOptions({
  key: [...LISTS, "mine"],
  query: () => listMyTournaments(),
});

/** Tournaments a player can still register for (HU25). */
export const availableTournamentsQuery = defineQueryOptions({
  key: [...LISTS, "available"],
  query: () => listAvailableTournaments(),
});

/** The tournaments the signed-in player is registered in. */
export const enrolledTournamentsQuery = defineQueryOptions({
  key: [...LISTS, "enrolled"],
  query: () => listEnrolledTournaments(),
});

export const tournamentQuery = defineQueryOptions((id: string) => ({
  key: tournamentKey(id),
  query: () => getTournament(id),
}));

export const enrolledPlayersQuery = defineQueryOptions((id: string) => ({
  key: [...tournamentKey(id), "players"],
  query: () => listEnrolledPlayers(id),
}));

export const roundsQuery = defineQueryOptions((id: string) => ({
  key: [...tournamentKey(id), "rounds"],
  query: () => listRounds(id),
}));

export const standingsQuery = defineQueryOptions((id: string) => ({
  key: [...tournamentKey(id), "standings"],
  query: () => getStandings(id),
}));

export const statsQuery = defineQueryOptions((id: string) => ({
  key: [...tournamentKey(id), "stats"],
  query: () => getTournamentStats(id),
}));

/**
 * After a change to a tournament (or news of one, in real time): everything
 * about it is read again, and so are the lists it appears in (its status may
 * have moved it from one to another). The server derives standings and round
 * states, so nothing is patched locally.
 */
export async function invalidateTournament(cache: QueryCache, id: string): Promise<void> {
  await Promise.all([
    cache.invalidateQueries({ key: tournamentKey(id) }),
    cache.invalidateQueries({ key: [...LISTS] }),
  ]);
}

/** Shows a tournament as the server answered a change to it, and refreshes the lists it appears in. */
export function showTournament(cache: QueryCache, tournament: Tournament): void {
  cache.setQueryData(tournamentQuery(tournament.id).key, tournament);
  cache.invalidateQueries({ key: [...LISTS] }).catch(() => undefined);
}

/** Adds a just-enrolled player to the tournament's roster (HU07). */
export function addEnrolledPlayer(cache: QueryCache, tournamentId: string, player: EnrolledPlayer): void {
  cache.setQueryData(enrolledPlayersQuery(tournamentId).key, (players = []) => [...players, player]);
}

/** Takes a withdrawn player off the tournament's roster (HU27). */
export function removeEnrolledPlayer(cache: QueryCache, tournamentId: string, playerId: string): void {
  cache.setQueryData(enrolledPlayersQuery(tournamentId).key, (players = []) =>
    players.filter((player) => player.playerId !== playerId),
  );
}

/** The tournament admin page's data (TournamentAdminView), started by its route. */
export function prefetchTournamentAdmin(id: string): void {
  prefetchQuery(tournamentQuery(id));
  prefetchQuery(enrolledPlayersQuery(id));
}

/** The tournament room's data (TournamentLiveView), started by its route. */
export function prefetchTournamentRoom(id: string): void {
  prefetchQuery(tournamentQuery(id));
  prefetchQuery(roundsQuery(id));
  prefetchQuery(standingsQuery(id));
  prefetchQuery(statsQuery(id));
}
