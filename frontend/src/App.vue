<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from "vue";

import SkipLink from "./components/layout/SkipLink.vue";
import { whenIdle } from "./lib/idle";
import { useAuthStore } from "./stores/auth";
import { useConfirmStore } from "./stores/confirm";

// The confirm dialog (and the dialog library under it) isn't part of the
// startup bundle: it mounts the first time something asks for a
// confirmation, then stays mounted. Only signed-in users can trigger one,
// so for them its code is prefetched once the page is idle, and the first
// "Delete…" click doesn't wait on a download.
const loadConfirmDialogHost = () => import("./components/ui/ConfirmDialogHost.vue");
const ConfirmDialogHost = defineAsyncComponent(loadConfirmDialogHost);

const confirm = useConfirmStore();
const auth = useAuthStore();
const confirmHostNeeded = ref(false);

watch(
  () => confirm.open,
  (open) => {
    if (open) confirmHostNeeded.value = true;
  },
);

watch(
  () => auth.isAuthenticated,
  (signedIn) => {
    if (signedIn) whenIdle(() => void loadConfirmDialogHost());
  },
  { immediate: true },
);
</script>

<template>
  <SkipLink />
  <!-- Keyed by path: /torneos/A/sala → /torneos/B/sala is a new page, not A's
       page left in place (its data, socket room and exports all belong to A).
       The query is left out of the key, so tabs and filters keep the page. -->
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" :key="route.path" />
  </RouterView>
  <ConfirmDialogHost v-if="confirmHostNeeded" />
</template>
