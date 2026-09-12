import { io } from "socket.io-client";

// Catálogo de eventos en tiempo real (ver README.md > Arquitectura).
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
