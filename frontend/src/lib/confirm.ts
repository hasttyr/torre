import { useConfirmStore, type ConfirmOptions } from "../stores/confirm";

/**
 * Asks the user to confirm an action via the app's confirm dialog.
 *
 * @remarks
 * Drop-in replacement for `window.confirm(message)`: `await` it and act on
 * the boolean, but it renders as an accessible, on-brand dialog (built on
 * reka-ui's AlertDialog) instead of a blocking native browser popup.
 *
 * @example
 * ```ts
 * const confirmed = await useConfirm()({
 *   title: t("clubs.deleteTitle"),
 *   message: t("clubs.deleteConfirm", { name: club.name }),
 *   danger: true,
 * });
 * if (!confirmed) return;
 * ```
 */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const store = useConfirmStore();
  return (options) => store.ask(options);
}
