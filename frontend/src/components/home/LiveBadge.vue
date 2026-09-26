<script setup lang="ts">
// Something happening right now (a game in play, standings kept live): a
// pulsing dot and its label. `compact` drops the label on phones, where the
// badge shares a row with other content.
defineProps<{ label: string; compact?: boolean }>();
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-success"
    :class="{ 'max-sm:p-1.5': compact }"
  >
    <span class="size-1.5 animate-live rounded-full bg-success" />
    <span :class="{ 'max-sm:hidden': compact }">{{ label }}</span>
  </span>
</template>
