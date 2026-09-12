// Catálogo de eventos en tiempo real (ver README.md > Arquitectura).
export const SOCKET_EVENTS = {
  PAIRING_PUBLISHED: "pairing.published",
  MATCH_RESULT_RECORDED: "match.result.recorded",
  STANDINGS_UPDATED: "standings.updated",
  PLAYER_WITHDRAWN: "player.withdrawn",
  PAIRING_ADJUSTED: "pairing.adjusted",
} as const;
