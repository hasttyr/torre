<script setup lang="ts">
// The frame of an illustration standing in for a screen of the app: a
// panel with a title bar, resting on its tile (hence the product shadow).
defineProps<{ title: string }>();
</script>

<template>
  <div class="overflow-hidden rounded-[22px] bg-surface text-left text-text shadow-product ring-1 ring-text/6">
    <div class="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5 sm:px-5">
      <span class="truncate text-sm font-semibold">{{ title }}</span>
      <slot name="status" />
    </div>
    <slot />
  </div>
</template>
