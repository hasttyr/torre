<script setup lang="ts">
// A single headline number with its label (a KPI tile).
defineProps<{
  label: string;
  value: string;
  hint?: string;
}>();
</script>

<template>
  <div class="flex flex-col gap-1 rounded-2xl border border-border-soft bg-surface-2/50 px-4 py-3.5">
    <dt class="text-xs font-semibold tracking-wide text-text-muted uppercase">{{ label }}</dt>
    <dd class="m-0 text-2xl font-semibold text-text">{{ value }}</dd>
    <p v-if="hint" class="text-xs text-text-faint">{{ hint }}</p>
  </div>
</template>
