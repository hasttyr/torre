// Catalog of real-time events (see README.md > Architecture).
// Deliberately duplicated in frontend/src/services/socket.ts (there is no
// shared package between the two npm projects): if you add, rename or
// remove an event here, replicate the change there too.
export const SOCKET_EVENTS = {
  PAIRING_PUBLISHED: "pairing.published",
  MATCH_RESULT_RECORDED: "match.result.recorded",
  STANDINGS_UPDATED: "standings.updated",
  PLAYER_WITHDRAWN: "player.withdrawn",
  PAIRING_ADJUSTED: "pairing.adjusted",
  TOURNAMENT_FINISHED: "tournament.finished",
} as const;
