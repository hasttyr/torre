import type { PrismaClient } from "@prisma/client";

import type { AuthUser } from "../../types/express";
import type { WidgetKey } from "./widgetCatalog";
import { loadPlayersOverview, loadTopPlayers, loadUsersByRole } from "./widgets/directoryWidgets";
import {
  loadPlayerGameLog,
  loadPlayerPerformanceTrend,
  loadPlayerResultsByColor,
  loadPlayerSummary,
  loadPlayerTournamentHistory,
} from "./widgets/playerWidgets";
import { loadRecentResults, loadTournamentsByStatus, loadUpcomingTournaments } from "./widgets/tournamentWidgets";

// How each widget gets its data. Adding a widget = one catalog key + one
// entry here (+ its component on the frontend); the route, controller and
// authorization in dashboard.service.ts never change (open/closed).
//
// `subject: "player"` widgets are about one player the viewer picks; the
// service guarantees `playerId` is inside the viewer's scope before calling
// `load`, so loaders never re-check permissions themselves.
export type WidgetDefinition =
  | { subject: "player"; load: (prisma: PrismaClient, playerId: string) => Promise<unknown> }
  | { subject: "none"; load: (prisma: PrismaClient, viewer: AuthUser) => Promise<unknown> };

export const WIDGET_REGISTRY: Record<WidgetKey, WidgetDefinition> = {
  PLAYER_SUMMARY: { subject: "player", load: loadPlayerSummary },
  PLAYER_PERFORMANCE_TREND: { subject: "player", load: loadPlayerPerformanceTrend },
  PLAYER_RESULTS_BY_COLOR: { subject: "player", load: loadPlayerResultsByColor },
  PLAYER_TOURNAMENT_HISTORY: { subject: "player", load: loadPlayerTournamentHistory },
  PLAYER_GAME_LOG: { subject: "player", load: loadPlayerGameLog },
  PLAYERS_OVERVIEW: { subject: "none", load: loadPlayersOverview },
  TOP_PLAYERS: { subject: "none", load: loadTopPlayers },
  TOURNAMENTS_BY_STATUS: { subject: "none", load: loadTournamentsByStatus },
  UPCOMING_TOURNAMENTS: { subject: "none", load: loadUpcomingTournaments },
  RECENT_RESULTS: { subject: "none", load: loadRecentResults },
  USERS_BY_ROLE: { subject: "none", load: loadUsersByRole },
};
