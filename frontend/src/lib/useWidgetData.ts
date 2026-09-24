import { ref, shallowRef, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";

import { getWidgetData, type WidgetKey } from "../services/dashboard";
import { extractErrorMessage } from "./errors";
import { usePlayerSelection } from "./playerSelection";

export interface WidgetData<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  reload: () => Promise<void>;
}

/**
 * Loads a widget's data, and reloads it whenever `subject` changes.
 *
 * @param subject - For player widgets: a getter for the selected player id.
 * While it returns null nothing is requested (the widget shows its "pick a
 * player" state instead). Omit it for widgets that aren't about one player.
 */
export function useWidgetData<T>(key: WidgetKey, subject?: () => string | null): WidgetData<T> {
  const { t } = useI18n();
  const data = shallowRef<T | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  // Switching players quickly can resolve requests out of order; only the
  // latest one is allowed to write.
  let latestRequest = 0;

  async function load(): Promise<void> {
    const playerId = subject?.() ?? null;
    const request = ++latestRequest;
    if (subject && !playerId) {
      data.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const result = await getWidgetData<T>(key, playerId ?? undefined);
      if (request === latestRequest) data.value = result;
    } catch (err) {
      if (request === latestRequest) error.value = extractErrorMessage(err, t("panel.widgetError"));
    } finally {
      if (request === latestRequest) loading.value = false;
    }
  }

  watch(() => subject?.() ?? null, load, { immediate: true });

  return { data, loading, error, reload: load };
}

/** {@link useWidgetData} for a widget about the dashboard's selected player. */
export function usePlayerWidgetData<T>(key: WidgetKey): WidgetData<T> & { subjectName: Ref<string | null> } {
  const selection = usePlayerSelection();
  return { ...useWidgetData<T>(key, () => selection.selectedId.value), subjectName: selection.selectedName };
}
