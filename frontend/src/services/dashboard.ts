import {
  CONFIGURABLE_ROLES,
  WIDGET_KEYS,
  type ColorResultsDto,
  type ConfigurableRole,
  type DashboardDto,
  type DashboardLayoutsDto,
  type GameLogEntryDto,
  type PerformancePointDto,
  type PlayerOverviewRowDto,
  type PlayerSummaryDto,
  type PlayerTotals as PlayerTotalsDto,
  type RecentResultDto,
  type ResultsByColorDto,
  type ResultTally as ResultTallyDto,
  type RoleLayoutDto,
  type SubjectPlayerDto,
  type TopPlayerDto,
  type TournamentHistoryEntryDto,
  type TournamentStatusCountDto,
  type UpcomingTournamentDto,
  type UsersByRoleDto,
  type WidgetKey,
  type WidgetSummaryDto,
} from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api, path } from "./api";

export { CONFIGURABLE_ROLES, WIDGET_KEYS, type ConfigurableRole, type WidgetKey };
export type WidgetSummary = Serialized<WidgetSummaryDto>;
export type SubjectPlayer = Serialized<SubjectPlayerDto>;
export type Dashboard = Serialized<DashboardDto>;
export type RoleLayout = Serialized<RoleLayoutDto>;
export type DashboardLayouts = Serialized<DashboardLayoutsDto>;
export type ResultTally = Serialized<ResultTallyDto>;
export type PlayerTotals = Serialized<PlayerTotalsDto>;
export type PlayerSummary = Serialized<PlayerSummaryDto>;
export type PerformancePoint = Serialized<PerformancePointDto>;
export type ColorResults = Serialized<ColorResultsDto>;
export type ResultsByColor = Serialized<ResultsByColorDto>;
export type TournamentHistoryEntry = Serialized<TournamentHistoryEntryDto>;
export type GameLogEntry = Serialized<GameLogEntryDto>;
export type PlayerOverviewRow = Serialized<PlayerOverviewRowDto>;
export type TopPlayer = Serialized<TopPlayerDto>;
export type TournamentStatusCount = Serialized<TournamentStatusCountDto>;
export type UpcomingTournament = Serialized<UpcomingTournamentDto>;
export type RecentResult = Serialized<RecentResultDto>;
export type UsersByRole = Serialized<UsersByRoleDto>;

/** The current user's dashboard: their widgets and the players they can inspect. */
export async function getDashboard(): Promise<Dashboard> {
  const { data } = await api.get<Dashboard>("/dashboard");
  return data;
}

/** One widget's data; `playerId` is required by player widgets. */
export async function getWidgetData<T>(key: WidgetKey, playerId?: string): Promise<T> {
  const { data } = await api.get<T>(path`/dashboard/widgets/${key}`, { params: playerId ? { playerId } : {} });
  return data;
}

/** The widget catalog and every role's layout (admin-only). */
export async function getDashboardLayouts(): Promise<DashboardLayouts> {
  const { data } = await api.get<DashboardLayouts>("/dashboard/layouts");
  return data;
}

/** Replaces a role's widgets, in the given order (admin-only). */
export async function updateRoleLayout(role: ConfigurableRole, widgets: WidgetKey[]): Promise<RoleLayout> {
  const { data } = await api.put<RoleLayout>(path`/dashboard/layouts/${role}`, { widgets });
  return data;
}

// --- widget payloads (see backend/src/services/dashboard/widgets/) ---
