<script setup lang="ts">
// A single headline number with its label (a KPI tile). One group of a
// parent <dl>: the wrapping <div> may only hold dt and dd, so the hint is
// a second description of the same term.
defineProps<{
  label: string;
  value: string;
  hint?: string;
}>();
</script>

<template>
  <div class="flex flex-col gap-1 rounded-2xl border border-border-soft bg-surface-2/50 px-4 py-3.5">
    <dt class="text-xs font-semibold tracking-wide text-text-muted uppercase">{{ label }}</dt>
    <dd class="m-0 text-2xl font-semibold text-text tabular-nums">{{ value }}</dd>
    <dd v-if="hint" class="m-0 text-xs text-text-faint">{{ hint }}</dd>
  </div>
</template>
