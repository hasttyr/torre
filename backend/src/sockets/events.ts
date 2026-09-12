// Catálogo de eventos en tiempo real (ver README.md > Arquitectura).
// Duplicado deliberadamente en frontend/src/services/socket.ts (no hay
// paquete compartido entre los dos proyectos npm): si agregás, renombrás o
// quitás un evento acá, replicá el cambio también en ese archivo.
export const SOCKET_EVENTS = {
  PAIRING_PUBLISHED: "pairing.published",
  MATCH_RESULT_RECORDED: "match.result.recorded",
  STANDINGS_UPDATED: "standings.updated",
  PLAYER_WITHDRAWN: "player.withdrawn",
  PAIRING_ADJUSTED: "pairing.adjusted",
} as const;
