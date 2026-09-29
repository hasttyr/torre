import { useQueryCache, type DefineQueryOptions } from "@pinia/colada";

/**
 * "Render as you fetch": asks the server for a page's data before the page
 * exists (from its route, while the page's code downloads), so the page finds
 * the request already in flight. A request already in flight for that entry
 * is reused; a failure stays in the entry, for the page to show.
 */
export function prefetchQuery<T>(options: DefineQueryOptions<T>): void {
  const cache = useQueryCache();
  const entry = cache.ensure(options);
  (entry.pending?.refreshCall ?? cache.fetch(entry)).catch(() => undefined);
}
