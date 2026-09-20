<script setup lang="ts">
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from "reka-ui";
import { useI18n } from "vue-i18n";

import { useConfirmStore } from "../../stores/confirm";

// Mounted once, in App.vue: every `useConfirm()` call across the app drives
// this single dialog through the confirm store, instead of each call site
// owning its own <dialog>/open-state boilerplate.
//
// Deliberately NOT using reka-ui's <AlertDialogAction>/<AlertDialogCancel>:
// both wrappers trigger their own internal close (emitting `update:open`)
// on top of whatever the wrapped button's own @click does, and the two
// racing to resolve the same promise made the *last* one to fire win —
// occasionally overriding a "confirm" click with a stale "false". Plain
// buttons calling confirm.resolve() directly are the single source of
// truth for the answer; the dialog closing is just a side effect of that.
const confirm = useConfirmStore();
const { t } = useI18n();

/** Reacts to the dialog being dismissed without an explicit button (Esc, overlay click). */
function onOpenChange(open: boolean): void {
  if (!open) {
    confirm.resolve(false);
  }
}
</script>

<template>
  <AlertDialogRoot :open="confirm.open" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-40 bg-black/50" />
      <AlertDialogContent
        class="card fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2"
      >
        <AlertDialogTitle class="text-lg">{{ confirm.title }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm text-text-muted">
          {{ confirm.message }}
        </AlertDialogDescription>

        <div class="mt-6 flex justify-end gap-2.5">
          <button type="button" class="btn btn-ghost" @click="confirm.resolve(false)">
            {{ confirm.cancelLabel ?? t("confirmDialog.cancel") }}
          </button>
          <button
            type="button"
            class="btn"
            :class="confirm.danger ? 'btn-danger' : 'btn-primary'"
            @click="confirm.resolve(true)"
          >
            {{ confirm.confirmLabel ?? t("confirmDialog.confirm") }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
