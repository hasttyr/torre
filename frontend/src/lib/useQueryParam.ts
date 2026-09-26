import { computed, type WritableComputedRef } from "vue";
import { useRoute, useRouter, type LocationQueryRaw, type Router } from "vue-router";

// The query the page asked for last. Several params can change in the same
// tick (a new filter also resets the page), and a navigation lands a few
// ticks later: building each write on this, not on the current route, keeps
// a write from dropping another that hasn't landed yet.
let requested: LocationQueryRaw | null = null;

function writeParam(router: Router, name: string, value: string | undefined): void {
  const query: LocationQueryRaw = { ...(requested ?? router.currentRoute.value.query), [name]: value };
  requested = query;
  void router.replace({ query }).finally(() => {
    if (requested === query) requested = null;
  });
}

/**
 * A piece of page state kept in the URL's query string (`?name=value`), so
 * it survives a reload and a copied link opens the page as it was: the
 * selected tab, round, player or club.
 *
 * Writes replace the current history entry (switching tabs shouldn't fill
 * the back button), and setting `fallback` removes the param so an
 * untouched page keeps a clean URL. For discrete choices; a text box
 * should keep its own ref and write here (see DataTable).
 */
export function useQueryParam(name: string, fallback = ""): WritableComputedRef<string> {
  const route = useRoute();
  const router = useRouter();

  return computed({
    get: () => {
      const value = route.query[name];
      return typeof value === "string" && value !== "" ? value : fallback;
    },
    set: (value) => writeParam(router, name, value === fallback ? undefined : value),
  });
}
