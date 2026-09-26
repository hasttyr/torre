import type { RouteLocationRaw, Router } from "vue-router";

/**
 * Starts downloading a page's code before the user clicks its link (on
 * hover or focus): the moment between pointing and clicking hides most of
 * the download. Only code — the page's data still loads on navigation.
 */
export function prefetchRoute(router: Router, to: RouteLocationRaw): void {
  for (const record of router.resolve(to).matched) {
    const component = record.components?.default;
    // A lazily loaded page is a loader function until the router resolves it.
    if (typeof component === "function") {
      (component as () => Promise<unknown>)().catch(() => undefined);
    }
  }
}
