import { api } from "./api";
import type { Tournament } from "./tournaments";

// Mirrors WIDGET_KEYS in backend/src/services/dashboard/widgetCatalog.ts
// (checked by src/contracts.test.ts).
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

// Mirrors CONFIGURABLE_ROLES (ADMINISTRATOR always sees every widget).
export const CONFIGURABLE_ROLES = ["PLAYER", "COACH", "ARBITER", "ORGANIZER"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export interface WidgetSummary {
  key: WidgetKey;
  // "player": the widget shows the player picked on the dashboard.
  subject: "player" | "none";
}

export interface SubjectPlayer {
  id: string;
  name: string;
}

export interface Dashboard {
  widgets: WidgetSummary[];
  players: SubjectPlayer[];
}

export interface RoleLayout {
  role: ConfigurableRole;
  widgets: WidgetKey[];
}

export interface DashboardLayouts {
  catalog: WidgetSummary[];
  layouts: RoleLayout[];
}

/** The current user's dashboard: their widgets and the players they can inspect. */
export async function getDashboard(): Promise<Dashboard> {
  const { data } = await api.get<Dashboard>("/dashboard");
  return data;
}

/** One widget's data; `playerId` is required by player widgets. */
export async function getWidgetData<T>(key: WidgetKey, playerId?: string): Promise<T> {
  const { data } = await api.get<T>(`/dashboard/widgets/${key}`, { params: playerId ? { playerId } : {} });
  return data;
}

/** The widget catalog and every role's layout (admin-only). */
export async function getDashboardLayouts(): Promise<DashboardLayouts> {
  const { data } = await api.get<DashboardLayouts>("/dashboard/layouts");
  return data;
}

/** Replaces a role's widgets, in the given order (admin-only). */
export async function updateRoleLayout(role: ConfigurableRole, widgets: WidgetKey[]): Promise<RoleLayout> {
  const { data } = await api.put<RoleLayout>(`/dashboard/layouts/${role}`, { widgets });
  return data;
}

// --- widget payloads (see backend/src/services/dashboard/widgets/) ---

export interface ResultTally {
  wins: number;
  draws: number;
  losses: number;
}

export interface PlayerTotals extends ResultTally {
  games: number;
  byes: number;
  points: number;
  scoreRate: number | null;
}

export interface PlayerSummary extends PlayerTotals {
  tournamentsPlayed: number;
  titles: number;
  bestFinish: number | null;
}

export interface PerformancePoint {
  tournamentId: string;
  name: string;
  startDate: string;
  scoreRate: number;
  points: number;
  games: number;
  rank: number;
  participants: number;
}

export interface ColorResults extends ResultTally {
  scoreRate: number | null;
}

export interface ResultsByColor {
  white: ColorResults;
  black: ColorResults;
}

export interface TournamentHistoryEntry {
  tournamentId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: Tournament["status"];
  withdrawn: boolean;
  rank: number | null;
  participants: number | null;
  points: number | null;
  buchholz: number | null;
}

// HU15: one game from the player's side of the board.
export interface GameLogEntry {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  // null for a bye (no opponent, no color).
  color: "WHITE" | "BLACK" | null;
  opponent: string | null;
  outcome: "WIN" | "DRAW" | "LOSS" | "BYE";
  recordedAt: string;
}

export interface PlayerOverviewRow extends PlayerTotals {
  playerId: string;
  name: string;
  program: string;
  tournaments: number;
}

export interface TopPlayer {
  playerId: string;
  name: string;
  tournaments: number;
  titles: number;
  podiums: number;
  points: number;
}

export interface TournamentStatusCount {
  status: Tournament["status"];
  count: number;
}

export interface UpcomingTournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: Tournament["status"];
  enrolled: number;
}

export interface RecentResult {
  id: string;
  tournamentName: string;
  round: number;
  board: number;
  white: string;
  black: string;
  value: "1-0" | "0-1" | "1/2-1/2";
  recordedAt: string;
}

export interface UsersByRole {
  role: string;
  active: number;
  inactive: number;
}
