// The dashboard widget catalog: the single list of widget keys the backend
// knows how to serve. Order here is the order the administrator's own
// dashboard (which always shows everything) and the layout editor use.
export const WIDGET_KEYS = [
  "PLAYER_SUMMARY",
  "PLAYER_PERFORMANCE_TREND",
  "PLAYER_RESULTS_BY_COLOR",
  "PLAYER_TOURNAMENT_HISTORY",
  "PLAYERS_OVERVIEW",
  "TOP_PLAYERS",
  "TOURNAMENTS_BY_STATUS",
  "UPCOMING_TOURNAMENTS",
  "RECENT_RESULTS",
  "USERS_BY_ROLE",
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];

/** Narrows an arbitrary string (e.g. a stored `role_widgets.widget_key`) to a known widget key. */
export function isWidgetKey(value: string): value is WidgetKey {
  return (WIDGET_KEYS as readonly string[]).includes(value);
}

// Every role whose dashboard the administrator can compose. ADMINISTRATOR
// isn't one of them: it always sees the whole catalog.
export const CONFIGURABLE_ROLES = ["PLAYER", "COACH", "ARBITER", "ORGANIZER"] as const;

export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];
