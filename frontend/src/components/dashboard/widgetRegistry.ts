import { defineAsyncComponent, h, type Component } from "vue";

import type { WidgetKey } from "../../services/dashboard";
import WidgetSkeleton from "./WidgetSkeleton.vue";

export interface WidgetView {
  component: Component;
  // Spans both columns of the dashboard grid (tables, dense tile rows).
  wide: boolean;
}

/**
 * Each widget is its own chunk, downloaded only when the dashboard actually
 * shows it (a role sees a handful of the eleven, and PanelView mounts them
 * as they near the viewport); its skeleton stands in while it loads.
 */
function lazyWidget(key: WidgetKey, loader: () => Promise<{ default: Component }>): Component {
  return defineAsyncComponent({
    loader,
    loadingComponent: { render: () => h(WidgetSkeleton, { widget: key }) },
    delay: 0,
  });
}

// How each catalog widget renders. Typed as a full Record so adding a key
// to WidgetKey without a component here fails the build. Title/description
// live in i18n under widgets.<KEY>, shared with the layout editor.
export const WIDGET_VIEWS: Record<WidgetKey, WidgetView> = {
  PLAYER_SUMMARY: {
    component: lazyWidget("PLAYER_SUMMARY", () => import("./widgets/PlayerSummaryWidget.vue")),
    wide: true,
  },
  PLAYER_PERFORMANCE_TREND: {
    component: lazyWidget("PLAYER_PERFORMANCE_TREND", () => import("./widgets/PerformanceTrendWidget.vue")),
    wide: false,
  },
  PLAYER_RESULTS_BY_COLOR: {
    component: lazyWidget("PLAYER_RESULTS_BY_COLOR", () => import("./widgets/ResultsByColorWidget.vue")),
    wide: false,
  },
  PLAYER_TOURNAMENT_HISTORY: {
    component: lazyWidget("PLAYER_TOURNAMENT_HISTORY", () => import("./widgets/TournamentHistoryWidget.vue")),
    wide: true,
  },
  PLAYER_GAME_LOG: {
    component: lazyWidget("PLAYER_GAME_LOG", () => import("./widgets/GameLogWidget.vue")),
    wide: true,
  },
  PLAYERS_OVERVIEW: {
    component: lazyWidget("PLAYERS_OVERVIEW", () => import("./widgets/PlayersOverviewWidget.vue")),
    wide: true,
  },
  TOP_PLAYERS: {
    component: lazyWidget("TOP_PLAYERS", () => import("./widgets/TopPlayersWidget.vue")),
    wide: false,
  },
  TOURNAMENTS_BY_STATUS: {
    component: lazyWidget("TOURNAMENTS_BY_STATUS", () => import("./widgets/TournamentsByStatusWidget.vue")),
    wide: false,
  },
  UPCOMING_TOURNAMENTS: {
    component: lazyWidget("UPCOMING_TOURNAMENTS", () => import("./widgets/UpcomingTournamentsWidget.vue")),
    wide: false,
  },
  RECENT_RESULTS: {
    component: lazyWidget("RECENT_RESULTS", () => import("./widgets/RecentResultsWidget.vue")),
    wide: false,
  },
  USERS_BY_ROLE: {
    component: lazyWidget("USERS_BY_ROLE", () => import("./widgets/UsersByRoleWidget.vue")),
    wide: false,
  },
};

/** Whether the frontend knows how to render `key` (a newer backend may send keys this build doesn't have). */
export function isRenderableWidget(key: string): key is WidgetKey {
  return key in WIDGET_VIEWS;
}
