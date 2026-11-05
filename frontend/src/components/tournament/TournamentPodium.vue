<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumber } from "../../lib/format";
import type { Standings } from "../../services/rounds";
import { useLocaleStore } from "../../stores/locale";

// A finished tournament's winners: the first three of its final standings
// on a podium, the champion in the middle and highest, gold deepening with
// the place. Whoever played it also reads where they finished.
const props = defineProps<{ standings: Standings }>();

const { t } = useI18n();
const locale = useLocaleStore();

const STEPS = [
  { place: 1, order: "order-2", height: "h-28 sm:h-36", tone: 1 },
  { place: 2, order: "order-1", height: "h-20 sm:h-24", tone: 0.55 },
  { place: 3, order: "order-3", height: "h-14 sm:h-16", tone: 0.35 },
];
// A step is named by the place its player holds, not by its position: a tie
// no tiebreak resolved is a shared place (UC13), two champions on 1.
const PLACE_NAMES: Record<number, string> = { 1: "podium.first", 2: "podium.second", 3: "podium.third" };

const podium = computed(() =>
  STEPS.flatMap((step) => {
    const row = props.standings.rows[step.place - 1];
    return row ? [{ ...step, row }] : [];
  }),
);

const viewer = computed(() => props.standings.rows.find((row) => row.playerId === props.standings.viewerPlayerId));
const points = (score: number) => t("podium.points", { points: formatNumber(score, locale.locale) });
</script>

<template>
  <section class="card flex flex-col gap-8" :aria-label="t('podium.title')" data-test="podium">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2 class="text-[1.375rem] tracking-[-0.025em]">{{ t("podium.title") }}</h2>
      <p v-if="viewer" class="text-[0.95rem] font-semibold text-text" data-test="podium-viewer">
        {{
          viewer.rank === 1
            ? t("podium.youWon")
            : t("podium.yourPlace", { rank: viewer.rank, total: standings.rows.length })
        }}
      </p>
    </div>

    <ol class="m-0 mx-auto grid w-full max-w-2xl list-none grid-cols-3 items-end gap-2 p-0 sm:gap-4">
      <li v-for="step in podium" :key="step.place" class="flex min-w-0 flex-col items-center" :class="step.order">
        <span
          class="mb-2 inline-flex size-10 items-center justify-center rounded-full font-display text-lg font-semibold tabular-nums"
          :class="step.row.rank === 1 ? 'bg-accent text-on-accent' : 'bg-text/8 text-text'"
          aria-hidden="true"
        >
          {{ step.row.rank }}
        </span>
        <span class="text-xs font-semibold text-text-muted">{{ t(PLACE_NAMES[step.row.rank] ?? "") }}</span>
        <strong
          class="mt-1 w-full truncate text-center text-[0.95rem] text-text sm:text-base"
          :class="{ 'text-accent': step.row.playerId === standings.viewerPlayerId }"
        >
          {{ step.row.name }}
        </strong>
        <span
          class="mt-1 mb-3 font-display text-[1.375rem] leading-tight font-semibold tracking-[-0.03em] text-text tabular-nums"
        >
          {{ points(step.row.score) }}
        </span>
        <span
          class="w-full rounded-t-2xl bg-chart-1"
          :class="step.height"
          :style="{ opacity: step.tone }"
          aria-hidden="true"
        />
      </li>
    </ol>
  </section>
</template>
