import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave } from "vue-router";

import { useConfirm } from "./confirm";

/** Whether any field of a form differs from the values it was saved (or started) with. */
export function hasChanges<T extends object>(current: T, saved: T): boolean {
  return (Object.keys(saved) as (keyof T)[]).some((key) => current[key] !== saved[key]);
}

/**
 * Warns before leaving a page while `isDirty()`: navigating inside the app
 * asks through the confirm dialog, and a reload or tab close gets the
 * browser's own prompt (the only one it allows there).
 *
 * @param messageKey - i18n key of the dialog's message, for pages that can
 *   say more precisely what would be lost.
 */
export function useUnsavedChangesGuard(isDirty: () => boolean, messageKey = "unsavedChanges.message"): void {
  const confirm = useConfirm();
  const { t } = useI18n();

  onBeforeRouteLeave(async () => {
    if (!isDirty()) return true;
    return confirm({
      title: t("unsavedChanges.title"),
      message: t(messageKey),
      confirmLabel: t("unsavedChanges.leave"),
      danger: true,
    });
  });

  function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!isDirty()) return;
    event.preventDefault();
    // Older Safari/Chrome only show the prompt when returnValue is set too.
    event.returnValue = "";
  }

  onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
  onBeforeUnmount(() => window.removeEventListener("beforeunload", onBeforeUnload));
}
