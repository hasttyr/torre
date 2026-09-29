import type { UseQueryReturn } from "@pinia/colada";
import { computed, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";

import { extractErrorMessage } from "../lib/errors";

type PageQuery = Pick<UseQueryReturn<unknown>, "status" | "error" | "refetch">;

export interface QueryStatus {
  /** Nothing to show yet: some query hasn't answered for the first time. */
  loading: ComputedRef<boolean>;
  /** The first failure, in the user's language; null while nothing failed. */
  loadError: ComputedRef<string | null>;
  /** Asks the server again for whatever failed (LoadError's retry button). */
  retry: () => Promise<void>;
}

/**
 * The loading and error states a page shows for the data it needs, the same
 * way on every page.
 *
 * @param fallbackKey - i18n key of the message for a failure the server didn't word.
 */
export function useQueryStatus(queries: PageQuery | PageQuery[], fallbackKey: string): QueryStatus {
  const list = Array.isArray(queries) ? queries : [queries];
  const { t } = useI18n();
  const failed = () => list.filter((query) => query.status.value === "error");

  return {
    loading: computed(() => list.some((query) => query.status.value === "pending")),
    loadError: computed(() => {
      const [first] = failed();
      return first ? extractErrorMessage(first.error.value, t(fallbackKey)) : null;
    }),
    retry: async () => {
      await Promise.all(failed().map((query) => query.refetch()));
    },
  };
}
