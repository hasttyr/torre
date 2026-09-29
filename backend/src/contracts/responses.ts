import type {
  ConfigurableRole,
  DataRequestStatus,
  DataRequestType,
  Disability,
  Gender,
  GameResult,
  MatchStatus,
  RoundStatus,
  StoredResult,
  Tiebreak,
  TournamentStatus,
  UserStatus,
  WidgetKey,
} from "./catalogs";

// The API's response bodies, as the backend builds them. Dates are `Date`
// here; over the wire (JSON) they're ISO strings, which is how the frontend
// types them (Serialized<T>). Only what a client may see: never a password
// hash, never an email the viewer isn't entitled to.

// --- Accounts -----------------------------------------------------------

/** HU21/RN-10: whether, when and which version of the data policy the person accepted. */
export interface DataConsentDto {
  accepted: boolean;
  date: Date | null;
  version: string | null;
}

export interface PlayerClubDto {
  id: string;
  name: string;
}

export interface PlayerProfileDto {
  universityCode: string;
  program: string;
  semester: number;
  birthDate: Date | null;
  // Computed from birthDate, never stored (so it can't go stale); null
  // without a birth date on file.
  age: number | null;
  gender: Gender | null;
  disability: Disability | null;
  // HU23: null when the player isn't in a club.
  club: PlayerClubDto | null;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  // The role's name, as stored (one of ROLES).
  role: string;
  createdAt: Date;
  dataConsent: DataConsentDto;
  // Only for an account with a player profile.
  player?: PlayerProfileDto;
}

/** A sign-in: the user. The session itself travels in an HttpOnly cookie, never in the body. */
export interface AuthResult {
  user: UserDto;
}

/** A one-minute ticket to open a real-time connection as the signed-in user. */
export interface SocketTicketDto {
  ticket: string;
}

/** HU24, the player's side: who follows them, or asks to. */
export interface MyCoachDto {
  id: string;
  name: string;
  email: string;
  /** When the player accepted the coach; null while it's a request waiting for them. */
  acceptedAt: Date | null;
}

/** Everything the system holds about a person (HU22, Ley 1581 art. 8: the right to know). */
export interface PersonalDataExport {
  profile: UserDto;
  coaches: { name: string; linkedAt: Date; acceptedAt: Date | null }[];
  tournaments: {
    tournament: { id: string; name: string; startDate: Date; endDate: Date; status: TournamentStatus };
    enrolledAt: Date;
    withdrawnAt: Date | null;
    pairingNumber: number | null;
    standing: { rank: number | null; score: number } | null;
  }[];
  games: {
    tournament: string;
    round: number;
    board: number;
    color: "WHITE" | "BLACK";
    opponent: string | null;
    result: string | null;
  }[];
  dataRequests: { type: DataRequestType; status: DataRequestStatus; createdAt: Date }[];
  auditedActions: { action: string; createdAt: Date }[];
}

/** The outcome of exercising a data-subject right (HU22). */
export interface DataRightResult {
  type: DataRequestType;
  status: DataRequestStatus;
  message: string;
  user: UserDto;
  // ACCESS only: everything held about the person.
  data?: PersonalDataExport;
}

// --- Audit log (RN-11) ---------------------------------------------------

export interface AuditLogDto {
  id: string;
  userId: string;
  userName: string;
  // One of AUDIT_ACTIONS for every entry written since the catalog exists.
  action: string;
  detail: string | null;
  createdAt: Date;
}

export interface AuditLogPage {
  entries: AuditLogDto[];
  // Pass it back as `cursor` for the next (older) page; null on the last one.
  nextCursor: string | null;
}

// --- Tournaments ---------------------------------------------------------

export interface TiebreakCriterionDto {
  name: Tiebreak;
  order: number;
}

export interface TournamentDto {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  format: string;
  roundsCount: number | null;
  timeControl: string | null;
  // Registration eligibility: null = no restriction on that criterion.
  restrictedProgram: string | null;
  minimumSemester: number | null;
  // HU28: what a bye is worth (1, 0.5 or 0).
  byePoints: number;
  organizerId: string;
  tiebreakCriteria: TiebreakCriterionDto[];
  createdAt: Date;
}

export interface EnrolledPlayerDto {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
  enrolledAt: Date;
}

export interface StandingRowDto {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  buchholz: number;
  buchholzCut1: number;
  sonnebornBerger: number;
  withdrawn: boolean;
}

export interface StandingsDto {
  tournamentId: string;
  // HU12: true while the latest published round still has games without a
  // result: the table is provisional until they're all in.
  pending: boolean;
  roundsCompleted: number;
  tiebreaks: Tiebreak[];
  rows: StandingRowDto[];
}

export interface BoardResults {
  whiteWins: number;
  draws: number;
  blackWins: number;
}

export interface RoundStatsDto extends BoardResults {
  round: number;
  // Games of the round still waiting for a result.
  pending: number;
}

export interface TournamentStatsDto extends BoardResults {
  tournamentId: string;
  activePlayers: number;
  withdrawnPlayers: number;
  gamesPlayed: number;
  byes: number;
  // Share of played games with a winner (0-1), null before the first game.
  decisiveRate: number | null;
  // White's points per game (0-1): the first-move advantage, as seen here.
  whiteScoreRate: number | null;
  rounds: RoundStatsDto[];
}

// --- Rounds --------------------------------------------------------------

export interface SeatDto {
  playerId: string;
  name: string;
}

export interface MatchDto {
  id: string;
  board: number;
  status: MatchStatus;
  white: SeatDto | null;
  black: SeatDto | null;
  // null while the game hasn't been recorded.
  result: StoredResult | null;
  isBye: boolean;
}

export interface RoundDto {
  id: string;
  number: number;
  status: RoundStatus;
  createdAt: Date;
  matches: MatchDto[];
}

// --- Clubs, players and coaches ------------------------------------------

export interface ClubDto {
  id: string;
  name: string;
  createdAt: Date;
}

export interface ClubPlayerDto {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
}

/** A search hit: never the email, which is only a search key. */
export interface PlayerSearchResultDto {
  id: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
}

/** HU24, the coach's side: a player they follow, or have asked to. */
export interface LinkedPlayerDto {
  playerId: string;
  name: string;
  universityCode: string;
  program: string;
  semester: number;
  linkedAt: Date;
  /** When the player accepted; null while it's still a request. */
  acceptedAt: Date | null;
}

export interface CoachTournamentPlayerDto {
  playerId: string;
  name: string;
}

export interface CoachTournamentDto extends TournamentDto {
  // Only the coach's own players enrolled in it, not the whole roster
  // (that stays with the organizer and the administrator).
  myPlayers: CoachTournamentPlayerDto[];
}

// --- Dashboard -----------------------------------------------------------

export interface WidgetSummaryDto {
  key: WidgetKey;
  // "player": the widget shows one player the viewer picks on the dashboard.
  subject: "player" | "none";
}

export interface SubjectPlayerDto {
  id: string;
  name: string;
}

export interface DashboardDto {
  widgets: WidgetSummaryDto[];
  // The players the viewer can pick as subject; empty when no widget needs one.
  players: SubjectPlayerDto[];
}

export interface RoleLayoutDto {
  role: ConfigurableRole;
  widgets: WidgetKey[];
}

export interface DashboardLayoutsDto {
  catalog: WidgetSummaryDto[];
  layouts: RoleLayoutDto[];
}

export interface ResultTally {
  wins: number;
  draws: number;
  losses: number;
}

export interface PlayerTotals extends ResultTally {
  games: number;
  byes: number;
  points: number;
  // Points per game actually played (0-1), null before the first game.
  // Byes are excluded: they're not a performance.
  scoreRate: number | null;
}

export interface PlayerSummaryDto extends PlayerTotals {
  tournamentsPlayed: number;
  titles: number;
  bestFinish: number | null;
}

export interface PerformancePointDto {
  tournamentId: string;
  name: string;
  startDate: Date;
  scoreRate: number;
  points: number;
  games: number;
  rank: number;
  participants: number;
}

export interface ColorResultsDto extends ResultTally {
  scoreRate: number | null;
}

export interface ResultsByColorDto {
  white: ColorResultsDto;
  black: ColorResultsDto;
}

export interface TournamentHistoryEntryDto {
  tournamentId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  withdrawn: boolean;
  // null while the tournament has no standings yet (not started).
  rank: number | null;
  participants: number | null;
  points: number | null;
  buchholz: number | null;
}

export interface GameLogEntryDto {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  // null for a bye (no opponent, no color).
  color: "WHITE" | "BLACK" | null;
  opponent: string | null;
  outcome: "WIN" | "DRAW" | "LOSS" | "BYE";
  recordedAt: Date;
}

export interface PlayerOverviewRowDto extends PlayerTotals {
  playerId: string;
  name: string;
  program: string;
  tournaments: number;
}

export interface TopPlayerDto {
  playerId: string;
  name: string;
  tournaments: number;
  titles: number;
  podiums: number;
  points: number;
}

export interface TournamentStatusCountDto {
  status: TournamentStatus;
  count: number;
}

export interface UpcomingTournamentDto {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  enrolled: number;
}

export interface RecentResultDto {
  id: string;
  tournamentName: string;
  round: number;
  board: number;
  white: string;
  black: string;
  // Byes aren't results anyone recorded, so they're left out.
  value: GameResult;
  recordedAt: Date;
}

export interface UsersByRoleDto {
  // The role's name, as stored (one of ROLES).
  role: string;
  active: number;
  inactive: number;
}
