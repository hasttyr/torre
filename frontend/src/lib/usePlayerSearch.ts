import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { searchPlayers, type PlayerSearchResult } from "../services/players";

const DEBOUNCE_MS = 300;

/**
 * The "find a player" box shared by clubs, a coach's players and tournament
 * enrollment: searches by name, email or university code once the user
 * stops typing (one request, not one per keystroke).
 *
 * `status` is what to put in a polite live region: the result list itself
 * appears and disappears, so screen readers wouldn't otherwise hear it.
 */
export function usePlayerSearch() {
  const { t } = useI18n();
  const query = ref("");
  const results = ref<PlayerSearchResult[]>([]);
  const searching = ref(false);
  // Whether `results` answer the current query (nothing to announce before that).
  const answered = ref(false);
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;
  let latestRequest = 0;

  watch(query, (value) => {
    clearTimeout(debounceHandle);
    // Any change (clearing included) makes a request still in flight stale.
    const request = ++latestRequest;
    answered.value = false;
    if (!value.trim()) {
      results.value = [];
      searching.value = false;
      return;
    }
    debounceHandle = setTimeout(async () => {
      searching.value = true;
      let found: PlayerSearchResult[] = [];
      try {
        found = await searchPlayers(value.trim());
      } catch {
        // A failed search reads as "no matches"; the user can just type again.
      }
      // A slower, older request must not overwrite a newer one's results.
      if (request !== latestRequest) return;
      results.value = found;
      searching.value = false;
      answered.value = true;
    }, DEBOUNCE_MS);
  });

  onBeforeUnmount(() => clearTimeout(debounceHandle));

  // Typed but not answered yet (waiting out the debounce, or in flight):
  // the list shows "searching" rather than a premature "no matches".
  const pending = computed(() => query.value.trim() !== "" && !answered.value);

  const status = computed(() => {
    if (searching.value) return t("playerSearch.searching");
    if (!pending.value && query.value.trim()) {
      return t("playerSearch.found", { count: results.value.length }, results.value.length);
    }
    return "";
  });

  /** Empties the box, e.g. once the chosen player was added. */
  function reset(): void {
    query.value = "";
    results.value = [];
  }

  return { query, results, pending, status, reset };
}
