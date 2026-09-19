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
