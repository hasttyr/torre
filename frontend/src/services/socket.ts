import { SOCKET_EVENTS } from "@contracts";
import type { Socket } from "socket.io-client";

import { isSignedIn } from "./session";

export { SOCKET_EVENTS };

let client: Promise<Socket> | undefined;

/**
 * The Socket.IO client, created (not connected) on first use. The library
 * is its own chunk: only the live views need it, and they fetch it while
 * their data loads instead of before they can even start rendering.
 *
 * @remarks
 * Each connection attempt, while signed in, sends a fresh one-minute ticket
 * (the socket may go straight to the API, where the session cookie isn't
 * sent). Published tournaments need none, but the server only lets a
 * tournament's managers follow it while it's a draft, and tells them about
 * draft rounds (backend/src/sockets/index.ts). Without a ticket the
 * connection is anonymous.
 */
/**
 * What a connection sends as it opens: a fresh ticket while signed in, else
 * nothing (an anonymous connection, which is also what a failed ticket
 * request leaves).
 */
export function introduceConnection(send: (auth: { ticket?: string }) => void): void {
  if (!isSignedIn()) return send({});
  import("./auth")
    .then(({ requestSocketTicket }) => requestSocketTicket())
    .then(
      (ticket) => send({ ticket }),
      () => send({}),
    );
}

export function getSocket(): Promise<Socket> {
  client ??= import("socket.io-client").then(({ io }) =>
    io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000", {
      autoConnect: false,
      auth: introduceConnection,
    }),
  );
  return client;
}

// Every real-time event is scoped to one tournament's room (see
// backend/src/sockets/rooms.ts) — a view showing a tournament joins it on
// mount and leaves it on unmount, so it only ever receives that
// tournament's pairing/result/standings events, never another one's.
/** Joins the given tournament's real-time room. */
export function joinTournamentRoom(socket: Socket, tournamentId: string): void {
  socket.emit("tournament:join", tournamentId);
}

/** Leaves the given tournament's real-time room. */
export function leaveTournamentRoom(socket: Socket, tournamentId: string): void {
  socket.emit("tournament:leave", tournamentId);
}
