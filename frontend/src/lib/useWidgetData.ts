import { useQuery } from "@pinia/colada";
import { computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";

import type { WidgetKey } from "../services/dashboard";
import { currentUserId, widgetQuery } from "./dashboardQueries";
import { extractErrorMessage } from "./errors";
import { usePlayerSelection } from "./playerSelection";

export interface WidgetData<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  reload: () => Promise<void>;
}

/**
 * A widget's data in the shape WidgetCard shows: loading, an error message,
 * or the data. Each subject is its own cache entry, so a slower answer for
 * the previous player lands in that player's entry and never shows for the
 * new one.
 *
 * @param subject - For a widget about one player: who it is. Until there's
 *   one, nothing is requested and the widget isn't loading.
 */
export function useWidgetData<T>(key: WidgetKey, subject?: () => string | null): WidgetData<T> {
  const { t } = useI18n();
  const playerId = (): string | null => subject?.() ?? null;
  const enabled = (): boolean => !subject || playerId() !== null;
  // Usually already on its way: PanelView prefetches a widget as it nears the viewport.
  const query = useQuery(() => ({ ...widgetQuery<T>(currentUserId(), key, playerId()), enabled: enabled() }));

  return {
    data: computed(() => query.data.value ?? null),
    // Nothing to show yet, with a request in flight or about to start (a
    // retry after an error shows the skeleton again).
    loading: computed(
      () => enabled() && query.data.value === undefined && (query.isPending.value || query.isLoading.value),
    ),
    error: computed(() =>
      query.status.value === "error" && !query.isLoading.value
        ? extractErrorMessage(query.error.value, t("panel.widgetError"))
        : null,
    ),
    reload: async () => {
      await query.refetch();
    },
  };
}

/** {@link useWidgetData} for a widget about the dashboard's selected player. */
export function usePlayerWidgetData<T>(key: WidgetKey): WidgetData<T> & { subjectName: Ref<string | null> } {
  const selection = usePlayerSelection();
  return { ...useWidgetData<T>(key, () => selection.selectedId.value), subjectName: selection.selectedName };
}
