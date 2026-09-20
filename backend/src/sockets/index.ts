import type { Server } from "socket.io";

import { tournamentRoom } from "./rooms";

/** Whether a value is a non-empty string — the only shape a tournament id can validly be. */
function isValidTournamentId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Registers connection lifecycle handlers on the Socket.IO server.
 *
 * @remarks
 * A client joins a tournament's room to receive its real-time events
 * (pairings, results, standings — see sockets/broadcast.ts) and leaves it
 * when it navigates away; Socket.IO also drops all of a socket's room
 * memberships automatically on disconnect, so no explicit cleanup is needed
 * there. Joining is intentionally open to any connected client (no auth
 * check): published pairings/standings are public within a tournament by
 * design (docs/DOCUMENTACION.md, HU09/HU14), the same information anyone
 * could see printed at the venue.
 */
export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    socket.on("tournament:join", (tournamentId: unknown) => {
      if (!isValidTournamentId(tournamentId)) return;
      socket.join(tournamentRoom(tournamentId));
    });

    socket.on("tournament:leave", (tournamentId: unknown) => {
      if (!isValidTournamentId(tournamentId)) return;
      socket.leave(tournamentRoom(tournamentId));
    });
  });
}
