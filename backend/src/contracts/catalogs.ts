// The API's closed catalogs: every value a request may send, or a response
// or real-time event may carry, for each coded field. The frontend imports
// these same lists (see index.ts), so changing one is changing the API.

/** Every role an account can have (RF03), in the order the UI lists them. */
export const ROLES = ["PLAYER", "COACH", "ARBITER", "ORGANIZER", "ADMINISTRATOR"] as const;
export type Role = (typeof ROLES)[number];

/** The roles a person can register with on their own (HU01); the rest are assigned by an administrator. */
export const SELF_ASSIGNABLE_ROLES = ["PLAYER", "COACH"] as const satisfies readonly Role[];
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// Profile catalogs (HU20): DANE's gender categories and the disability types
// of Colombia's RLCPD, instead of free text.
export const GENDERS = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;
export type Gender = (typeof GENDERS)[number];

export const DISABILITIES = [
  "NONE",
  "PHYSICAL_MOTOR",
  "VISUAL",
  "HEARING",
  "COGNITIVE",
  "PSYCHOSOCIAL",
  "MULTIPLE",
  "OTHER",
] as const;
export type Disability = (typeof DISABILITIES)[number];

export const TOURNAMENT_STATUSES = [
  "CREATED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "IN_PROGRESS",
  "FINISHED",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const ROUND_STATUSES = ["GENERATED", "RECORDING_RESULTS", "STANDINGS_UPDATED"] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const MATCH_STATUSES = ["SCHEDULED", "IN_PROGRESS", "FINISHED", "CORRECTED"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** RN-03: the results a person can record, in the order the UI offers them. */
export const GAME_RESULTS = ["1-0", "1/2-1/2", "0-1"] as const;
export type GameResult = (typeof GAME_RESULTS)[number];

/** Every stored result: the recordable ones plus "BYE", which only the pairing engine assigns. */
export const STORED_RESULTS = [...GAME_RESULTS, "BYE"] as const;
export type StoredResult = (typeof STORED_RESULTS)[number];

// HU13's tiebreak criteria, labelled by each client in its own language.
// ARO is listed because the documentation lists it, but it's skipped when
// ranking: it needs ratings, which are out of scope.
export const TIEBREAKS = ["BUCHHOLZ", "BUCHHOLZ_CUT1", "SONNEBORN_BERGER", "DIRECT_ENCOUNTER", "ARO"] as const;
export type Tiebreak = (typeof TIEBREAKS)[number];

/** HU13's suggested order, for a tournament that has none yet. */
export const DEFAULT_TIEBREAKS: readonly Tiebreak[] = [
  "BUCHHOLZ",
  "BUCHHOLZ_CUT1",
  "SONNEBORN_BERGER",
  "ARO",
  "DIRECT_ENCOUNTER",
];

/** The data-subject rights a person can exercise over their own data (HU22, Ley 1581 art. 8). */
export const DATA_REQUEST_TYPES = ["ACCESS", "RECTIFICATION", "SUPPRESSION"] as const;
export type DataRequestType = (typeof DATA_REQUEST_TYPES)[number];

/** BLOCKED: a suppression waits while a tournament in progress still needs the data. */
export const DATA_REQUEST_STATUSES = ["RESOLVED", "BLOCKED"] as const;
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

// The dashboard widgets the API can serve. This order is the order of the
// administrator's own dashboard (which shows them all) and the layout editor.
export const WIDGET_KEYS = [
  "PLAYER_SUMMARY",
  "PLAYER_PERFORMANCE_TREND",
  "PLAYER_RESULTS_BY_COLOR",
  "PLAYER_TOURNAMENT_HISTORY",
  "PLAYER_GAME_LOG",
  "PLAYERS_OVERVIEW",
  "TOP_PLAYERS",
  "TOURNAMENTS_BY_STATUS",
  "UPCOMING_TOURNAMENTS",
  "RECENT_RESULTS",
  "USERS_BY_ROLE",
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

/** The roles whose dashboard an administrator composes; ADMINISTRATOR always sees the whole catalog. */
export const CONFIGURABLE_ROLES = ["PLAYER", "COACH", "ARBITER", "ORGANIZER"] as const satisfies readonly Role[];
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

/** The critical actions the audit log records (RN-11). */
export const AUDIT_ACTIONS = [
  "ROLE_CHANGED",
  "ACCOUNT_STATUS_CHANGED",
  "PLAYER_WITHDRAWN",
  "RESULT_CORRECTED",
  "PAIRING_ADJUSTED",
  "TOURNAMENT_FINISHED",
  "DASHBOARD_LAYOUT_CHANGED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** The real-time events a tournament room receives (see README.md > Tiempo real). */
export const SOCKET_EVENTS = {
  PAIRING_PUBLISHED: "pairing.published",
  MATCH_RESULT_RECORDED: "match.result.recorded",
  STANDINGS_UPDATED: "standings.updated",
  PLAYER_WITHDRAWN: "player.withdrawn",
  PAIRING_ADJUSTED: "pairing.adjusted",
  TOURNAMENT_FINISHED: "tournament.finished",
} as const;
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
