<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import type { ResultTally } from "../../services/dashboard";

// One stacked bar splitting games into wins / draws / losses (a diverging
// scale: blue <-> neutral gray <-> red). Segments are separated by a 2px gap
// instead of borders; the counts are always printed next to the bar, so the
// split is readable without telling the colors apart. Pair with
// <ResultLegend> once per widget.
// `perspective`: "player" reads the split as win/draw/loss for one player;
// "board" as white wins/draw/black wins across a tournament's games.
const props = withDefaults(
  defineProps<{ tally: ResultTally; label?: string; compact?: boolean; perspective?: "player" | "board" }>(),
  { label: undefined, compact: false, perspective: "player" },
);
const names = computed(() => (props.perspective === "board" ? "widgets.boardResults" : "widgets.results"));

const { t } = useI18n();

const total = computed(() => props.tally.wins + props.tally.draws + props.tally.losses);

const segments = computed(() =>
  (
    [
      { key: "wins", color: "bg-chart-win", value: props.tally.wins },
      { key: "draws", color: "bg-chart-draw", value: props.tally.draws },
      { key: "losses", color: "bg-chart-loss", value: props.tally.losses },
    ] as const
  ).filter((segment) => segment.value > 0),
);

const summary = computed(() =>
  t(`${names.value}.summary`, { wins: props.tally.wins, draws: props.tally.draws, losses: props.tally.losses }),
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="label" class="flex items-baseline justify-between gap-2 text-sm">
      <span class="font-semibold text-text">{{ label }}</span>
      <span class="text-text-muted tabular-nums">{{ summary }}</span>
    </div>
    <div
      class="flex w-full gap-[2px] overflow-hidden rounded-[4px]"
      :class="compact ? 'h-2' : 'h-3.5'"
      role="img"
      :aria-label="label ? `${label}: ${summary}` : summary"
    >
      <div v-if="total === 0" class="h-full w-full bg-surface-2" />
      <div
        v-for="segment in segments"
        :key="segment.key"
        class="h-full transition-[flex-grow] duration-500"
        :class="segment.color"
        :style="{ flexGrow: segment.value, flexBasis: 0 }"
        :title="`${t(`${names}.${segment.key}`)}: ${segment.value}`"
      />
    </div>
  </div>
</template>
