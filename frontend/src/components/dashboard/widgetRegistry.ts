import type { Component } from "vue";

import type { WidgetKey } from "../../services/dashboard";
import GameLogWidget from "./widgets/GameLogWidget.vue";
import PerformanceTrendWidget from "./widgets/PerformanceTrendWidget.vue";
import PlayersOverviewWidget from "./widgets/PlayersOverviewWidget.vue";
import PlayerSummaryWidget from "./widgets/PlayerSummaryWidget.vue";
import RecentResultsWidget from "./widgets/RecentResultsWidget.vue";
import ResultsByColorWidget from "./widgets/ResultsByColorWidget.vue";
import TopPlayersWidget from "./widgets/TopPlayersWidget.vue";
import TournamentHistoryWidget from "./widgets/TournamentHistoryWidget.vue";
import TournamentsByStatusWidget from "./widgets/TournamentsByStatusWidget.vue";
import UpcomingTournamentsWidget from "./widgets/UpcomingTournamentsWidget.vue";
import UsersByRoleWidget from "./widgets/UsersByRoleWidget.vue";

export interface WidgetView {
  component: Component;
  // Spans both columns of the dashboard grid (tables, dense tile rows).
  wide: boolean;
}

// How each catalog widget renders. Typed as a full Record so adding a key
// to WidgetKey without a component here fails the build. Title/description
// live in i18n under widgets.<KEY>, shared with the layout editor.
export const WIDGET_VIEWS: Record<WidgetKey, WidgetView> = {
  PLAYER_SUMMARY: { component: PlayerSummaryWidget, wide: true },
  PLAYER_PERFORMANCE_TREND: { component: PerformanceTrendWidget, wide: false },
  PLAYER_RESULTS_BY_COLOR: { component: ResultsByColorWidget, wide: false },
  PLAYER_TOURNAMENT_HISTORY: { component: TournamentHistoryWidget, wide: true },
  PLAYER_GAME_LOG: { component: GameLogWidget, wide: true },
  PLAYERS_OVERVIEW: { component: PlayersOverviewWidget, wide: true },
  TOP_PLAYERS: { component: TopPlayersWidget, wide: false },
  TOURNAMENTS_BY_STATUS: { component: TournamentsByStatusWidget, wide: false },
  UPCOMING_TOURNAMENTS: { component: UpcomingTournamentsWidget, wide: false },
  RECENT_RESULTS: { component: RecentResultsWidget, wide: false },
  USERS_BY_ROLE: { component: UsersByRoleWidget, wide: false },
};

/** Whether the frontend knows how to render `key` (a newer backend may send keys this build doesn't have). */
export function isRenderableWidget(key: string): key is WidgetKey {
  return key in WIDGET_VIEWS;
}
