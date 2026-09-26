<script setup lang="ts">
import { useI18n } from "vue-i18n";

// Legend for <ResultSplitBar>: rendered once per widget, above its bars,
// with the same `perspective` as the bars it explains.
const props = withDefaults(defineProps<{ perspective?: "player" | "board" }>(), { perspective: "player" });
const { t } = useI18n();

const ENTRIES = [
  { key: "wins", color: "bg-chart-win" },
  { key: "draws", color: "bg-chart-draw" },
  { key: "losses", color: "bg-chart-loss" },
] as const;
</script>

<template>
  <ul class="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-text-muted">
    <li v-for="entry in ENTRIES" :key="entry.key" class="inline-flex items-center gap-1.5">
      <span class="inline-block h-2.5 w-2.5 rounded-sm" :class="entry.color" aria-hidden="true" />
      {{ t(`${props.perspective === "board" ? "widgets.boardResults" : "widgets.results"}.${entry.key}`) }}
    </li>
  </ul>
</template>
