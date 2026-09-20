import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import ConfirmDialogHost from "../components/ui/ConfirmDialogHost.vue";
import { i18n } from "../i18n";

/**
 * Mounts the app's single confirm dialog host, the same way `App.vue` does.
 *
 * @remarks
 * A view/component test that triggers `useConfirm()` needs this mounted
 * alongside it (sharing the same active Pinia instance) for the dialog to
 * actually render — otherwise the confirm store just flips `open: true`
 * with nothing subscribed to show it.
 */
export function mountConfirmDialogHost() {
  return mount(ConfirmDialogHost, { global: { plugins: [i18n] } });
}

/**
 * Clicks a button inside the confirm dialog, by its visible text.
 *
 * @remarks
 * reka-ui's AlertDialog renders via a Teleport straight to `document.body`,
 * outside the mounted wrapper's own element tree — `@vue/test-utils`'
 * `wrapper.find()` can't see it, so this queries the real DOM directly.
 *
 * @throws {Error} if no button with that exact text is currently in the DOM.
 */
export async function clickConfirmDialogButton(text: string): Promise<void> {
  const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent === text);
  if (!button) {
    throw new Error(`Confirm dialog button "${text}" not found in the DOM`);
  }
  button.click();
  await nextTick();
}
