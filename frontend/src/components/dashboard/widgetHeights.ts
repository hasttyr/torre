import type { WidgetKey } from "../../services/dashboard";

/**
 * How tall each widget's placeholder stands while its code or data loads:
 * the smallest height the widget was measured at with real data, on a phone
 * and from sm up. A placeholder shorter than what replaces it shoves the
 * cards below it down (the player's summary grew from 208px to ~700px on a
 * phone: CLS 0.3, "poor"); one no taller than the smallest real widget never
 * makes the page jump back up. Tables vary with their rows, so theirs is a
 * floor, not a guess.
 *
 * Full class strings, so Tailwind finds them in this file.
 */
export const WIDGET_MIN_HEIGHT: Record<WidgetKey, string> = {
  PLAYER_SUMMARY: "min-h-[42rem] sm:min-h-[19rem]",
  PLAYER_PERFORMANCE_TREND: "min-h-[22rem] sm:min-h-[21rem]",
  PLAYER_RESULTS_BY_COLOR: "min-h-[17rem]",
  PLAYER_TOURNAMENT_HISTORY: "min-h-[36rem]",
  PLAYER_GAME_LOG: "min-h-[36rem]",
  UPCOMING_TOURNAMENTS: "min-h-[12.5rem]",
  PLAYERS_OVERVIEW: "min-h-[36rem] sm:min-h-[25rem]",
  RECENT_RESULTS: "min-h-[44rem]",
  TOP_PLAYERS: "min-h-[48rem]",
  TOURNAMENTS_BY_STATUS: "min-h-[35rem]",
  USERS_BY_ROLE: "min-h-[23rem]",
};
