<script setup lang="ts">
import { computed } from "vue";

import type { BarListItem } from "./types";

// Horizontal bars for comparing magnitudes across a handful of categories.
// Single series, so no legend: the widget's title names what's measured,
// and every bar carries its value at the tip.
const props = defineProps<{
  items: BarListItem[];
  // Accessible name of the chart (announced by screen readers).
  label: string;
}>();

const max = computed(() => Math.max(1, ...props.items.map((item) => item.value)));
</script>

<template>
  <ul class="m-0 flex list-none flex-col gap-3 p-0" :aria-label="label">
    <li
      v-for="item in items"
      :key="item.key"
      class="grid grid-cols-[minmax(6.5rem,11rem)_1fr] items-center gap-3 text-sm"
    >
      <div class="min-w-0">
        <p class="truncate text-text">{{ item.label }}</p>
        <p v-if="item.detail" class="truncate text-xs text-text-faint">{{ item.detail }}</p>
      </div>
      <div class="flex min-w-0 items-center gap-2">
        <!-- The longest bar spans 85% of the track, leaving room for its value
             at the tip; a zero value still gets a 2px stub so the row doesn't
             look missing. -->
        <div class="h-3 min-w-[2px] rounded-r-[4px] bg-chart-1" :style="{ width: `${(item.value / max) * 85}%` }" />
        <span class="shrink-0 font-semibold text-text tabular-nums">{{ item.valueLabel ?? item.value }}</span>
      </div>
    </li>
  </ul>
</template>
