import { useQueryCache, type DefineQueryOptions } from "@pinia/colada";

import { getDashboard, getWidgetData, type Dashboard, type WidgetKey } from "../services/dashboard";
import { useAuthStore } from "../stores/auth";

// The dashboard's server data, cached with Pinia Colada. Every entry is keyed
// by the signed-in user, so on a shared lab computer the next person never
// gets the previous one's cached panel. The options are set on each query,
// not through the PiniaColada plugin, which keeps Colada out of the startup
// bundle; they keep the dashboard behaving as before: an answer serves for
// 15 s whoever started it (the route, a widget nearing the viewport), and
// returning to the tab doesn't refetch.
const FRESHNESS = { staleTime: 15_000, refetchOnWindowFocus: false } as const;

/** The dashboard's widget list and selectable players. */
export function panelQuery(userId: string): DefineQueryOptions<Dashboard> {
  return { key: ["dashboard", userId], query: () => getDashboard(), ...FRESHNESS };
}

/** One widget's data; `playerId` for a widget about one player. */
export function widgetQuery<T>(userId: string, key: WidgetKey, playerId: string | null): DefineQueryOptions<T> {
  return {
    key: ["dashboard", userId, "widget", key, playerId ?? ""],
    query: () => getWidgetData<T>(key, playerId ?? undefined),
    ...FRESHNESS,
  };
}

/** The signed-in user's id, which every dashboard entry is keyed by. */
export function currentUserId(): string {
  return useAuthStore().user?.id ?? "";
}

/**
 * Asks the server for `options` right away (every visit gets fresh data, as
 * it always did), unless a request for that entry is already in flight,
 * which is reused. A failure stays in the entry, for the page to show.
 */
function prefetch<T>(options: DefineQueryOptions<T>): void {
  const cache = useQueryCache();
  const entry = cache.ensure(options);
  (entry.pending?.refreshCall ?? cache.fetch(entry)).catch(() => undefined);
}

/** The panel's data, started by its route while the page's code downloads. */
export function prefetchPanel(): void {
  prefetch(panelQuery(currentUserId()));
}

/** A widget's data, started as it nears the viewport, alongside its code. */
export function prefetchWidget(key: WidgetKey, playerId: string | null): void {
  prefetch(widgetQuery(currentUserId(), key, playerId));
}
