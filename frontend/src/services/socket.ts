import { io } from "socket.io-client";

// Catalog of real-time events (see README.md > Architecture).
// Deliberately duplicated in backend/src/sockets/events.ts (there is no
// shared package between the two npm projects): if you add, rename or
// remove an event here, replicate the change there too.
export const SOCKET_EVENTS = {
  PAIRING_PUBLISHED: "pairing.published",
  MATCH_RESULT_RECORDED: "match.result.recorded",
  STANDINGS_UPDATED: "standings.updated",
  PLAYER_WITHDRAWN: "player.withdrawn",
  PAIRING_ADJUSTED: "pairing.adjusted",
} as const;

export const socket = io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000", {
  autoConnect: false,
});

// Every real-time event is scoped to one tournament's room (see
// backend/src/sockets/rooms.ts) — a view showing a tournament joins it on
// mount and leaves it on unmount, so it only ever receives that
// tournament's pairing/result/standings events, never another one's.
/** Joins the given tournament's real-time room. */
export function joinTournamentRoom(tournamentId: string): void {
  socket.emit("tournament:join", tournamentId);
}

/** Leaves the given tournament's real-time room. */
export function leaveTournamentRoom(tournamentId: string): void {
  socket.emit("tournament:leave", tournamentId);
}
