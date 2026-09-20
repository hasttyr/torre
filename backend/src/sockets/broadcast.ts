import type { Server } from "socket.io";

import { tournamentRoom } from "./rooms";

// Mirrors config/prisma.ts's singleton pattern: `server.ts` creates the one
// real Server instance at boot and registers it here, so any future service
// (HU08's pairing generation, HU10's result recording, ...) can broadcast
// without threading `io` through every function signature down from the
// controller — the same way they already just `import { prisma }` instead
// of receiving it as a global argument.
let ioInstance: Server | null = null;

/** Registers the live Socket.IO server instance. Called once, from server.ts at boot. */
export function setSocketServer(io: Server): void {
  ioInstance = io;
}

/** Test-only: clears the registered instance so tests don't leak state into each other. */
export function resetSocketServer(): void {
  ioInstance = null;
}

/**
 * Broadcasts a real-time event to every client watching a tournament
 * (`pairing.published`, `match.result.recorded`, `standings.updated`, ...
 * from sockets/events.ts).
 *
 * @remarks
 * A no-op if called before the server boots (e.g. from a unit test that
 * exercises a service directly without spinning up Socket.IO) — a service's
 * business logic shouldn't have to know or care whether a socket server is
 * currently attached.
 */
export function emitToTournament(tournamentId: string, event: string, payload: unknown): void {
  ioInstance?.to(tournamentRoom(tournamentId)).emit(event, payload);
}
