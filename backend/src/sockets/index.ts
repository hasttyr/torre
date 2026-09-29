import type { Server, Socket } from "socket.io";

import { logger } from "../config/logger";
import { prisma } from "../config/prisma";
import { authenticateSocketTicket } from "../middlewares/auth";
import { canManageTournament } from "../services/tournamentAccess";
import type { AuthUser } from "../types/express";
import { tournamentManagersRoom, tournamentRoom } from "./rooms";

// A view follows one tournament at a time; a handful covers several tabs.
const MAX_ROOMS_PER_CONNECTION = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ack = (joined: boolean) => void;

interface SocketData {
  // Who opened the connection, when its handshake carried a valid session token.
  user?: AuthUser;
}

const sessionOf = (socket: Socket): SocketData => socket.data as SocketData;

/** The tournament rooms a connection is in (Socket.IO also puts it in a room of its own). */
function tournamentRoomCount(socket: Socket): number {
  return [...socket.rooms].filter((room) => room.startsWith("tournament:") && !room.endsWith(":managers")).length;
}

/**
 * Lets a connection into a tournament's room, and its managers' room if it
 * may manage it. Same visibility as the REST API (HU18): a published
 * tournament is open to anyone, a draft (CREATED) only to whoever manages it.
 */
async function joinTournament(socket: Socket, tournamentId: unknown): Promise<boolean> {
  if (typeof tournamentId !== "string" || !UUID.test(tournamentId)) return false;
  if (tournamentRoomCount(socket) >= MAX_ROOMS_PER_CONNECTION) return false;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { status: true, organizerId: true },
  });
  if (!tournament) return false;
  const viewer = sessionOf(socket).user;
  const manages = viewer !== undefined && canManageTournament(tournament, viewer);
  if (tournament.status === "CREATED" && !manages) return false;

  await socket.join(tournamentRoom(tournamentId));
  if (manages) await socket.join(tournamentManagersRoom(tournamentId));
  return true;
}

/**
 * Registers connection lifecycle handlers on the Socket.IO server.
 *
 * @remarks
 * A client joins a tournament's room to receive its real-time events
 * (pairings, results, standings — see sockets/broadcast.ts) and leaves it
 * when it navigates away; Socket.IO also drops all of a socket's room
 * memberships automatically on disconnect. Published pairings/standings are
 * public within a tournament by design (docs/DOCUMENTACION.md, HU09/HU14),
 * the same information anyone could see printed at the venue, so signing in
 * is optional: the handshake's ticket (`auth: { ticket }`, from POST
 * /auth/socket-ticket, since a socket may go straight to the API, where the
 * session cookie isn't sent) only decides who may follow drafts.
 * `tournament:join` answers (acknowledgement) whether the connection got in.
 */
export function registerSocketHandlers(io: Server): void {
  io.use((socket, next) => {
    const ticket: unknown = socket.handshake.auth?.ticket;
    if (typeof ticket !== "string") return next();
    authenticateSocketTicket(ticket).then(
      (user) => {
        sessionOf(socket).user = user;
        next();
      },
      // An expired ticket, or a revoked session, just means an anonymous connection.
      () => next(),
    );
  });

  io.on("connection", (socket) => {
    socket.on("tournament:join", (tournamentId: unknown, ack?: Ack) => {
      joinTournament(socket, tournamentId).then(
        (joined) => ack?.(joined),
        (error: unknown) => {
          logger.error({ err: error, tournamentId }, "socket could not join a tournament room");
          ack?.(false);
        },
      );
    });

    socket.on("tournament:leave", (tournamentId: unknown) => {
      if (typeof tournamentId !== "string") return;
      socket.leave(tournamentRoom(tournamentId));
      socket.leave(tournamentManagersRoom(tournamentId));
    });
  });
}
