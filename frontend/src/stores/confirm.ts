import { defineStore } from "pinia";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Styles the confirm button red instead of the accent color, for
  // destructive actions (delete, deactivate, withdraw, ...).
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

// The pending Promise's resolver lives outside Pinia's reactive state on
// purpose: a function isn't serializable state, and Pinia would otherwise
// try to make it reactive for no benefit.
let resolvePending: ((value: boolean) => void) | null = null;

export const useConfirmStore = defineStore("confirm", {
  state: (): ConfirmState => ({
    open: false,
    title: "",
    message: "",
    confirmLabel: undefined,
    cancelLabel: undefined,
    danger: false,
  }),
  actions: {
    /**
     * Opens the confirm dialog and resolves once the user answers.
     *
     * @remarks
     * Replaces `window.confirm()`: same call shape (await it, get a
     * boolean), but rendered as an accessible, themeable dialog instead of
     * a blocking native browser popup.
     */
    ask(options: ConfirmOptions): Promise<boolean> {
      // A second call while one is already pending shouldn't happen in
      // practice (the triggering button is disabled while its own action is
      // in flight), but resolving the stale one false keeps this safe.
      resolvePending?.(false);

      this.title = options.title;
      this.message = options.message;
      this.confirmLabel = options.confirmLabel;
      this.cancelLabel = options.cancelLabel;
      this.danger = options.danger ?? false;
      this.open = true;

      return new Promise<boolean>((resolve) => {
        resolvePending = resolve;
      });
    },

    /** Resolves the pending confirmation with the given answer and closes the dialog. */
    resolve(answer: boolean): void {
      this.open = false;
      resolvePending?.(answer);
      resolvePending = null;
    },
  },
});
