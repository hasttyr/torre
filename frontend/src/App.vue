<script setup lang="ts">
import SkipLink from "./components/layout/SkipLink.vue";
import ConfirmDialogHost from "./components/ui/ConfirmDialogHost.vue";
</script>

<template>
  <SkipLink />
  <RouterView />
  <ConfirmDialogHost />
</template>
