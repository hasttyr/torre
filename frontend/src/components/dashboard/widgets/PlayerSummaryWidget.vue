<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumber, formatPercent } from "../../../lib/format";
import { usePlayerWidgetData } from "../../../lib/useWidgetData";
import type { PlayerSummary } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import ResultLegend from "../../charts/ResultLegend.vue";
import ResultSplitBar from "../../charts/ResultSplitBar.vue";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload, subjectName } = usePlayerWidgetData<PlayerSummary>("PLAYER_SUMMARY");

// The score rate is the answer to "how is this player doing": it leads, as
// a gold ring that fills to the rate, with the career's other figures set
// beside it as plain type.
const RING_RADIUS = 64;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const ringFill = computed(() => Math.min(1, Math.max(0, data.value?.scoreRate ?? 0)) * RING_LENGTH);

const stats = computed(() => {
  const summary = data.value;
  if (!summary) return [];
  return [
    { key: "games", value: String(summary.games) },
    { key: "points", value: formatNumber(summary.points, locale.locale) },
    { key: "tournaments", value: String(summary.tournamentsPlayed) },
    { key: "titles", value: String(summary.titles) },
    {
      key: "bestFinish",
      value: summary.bestFinish === null ? "—" : t("widgets.ordinal", { n: summary.bestFinish }),
    },
  ];
});
</script>

<template>
  <WidgetCard
    widget="PLAYER_SUMMARY"
    :loading="loading"
    :error="error"
    :empty="!data || data.tournamentsPlayed === 0"
    :empty-message="data ? t('widgets.PLAYER_SUMMARY.empty') : t('panel.noSubject')"
    :subject-name="subjectName"
    @retry="reload"
  >
    <div v-if="data" class="grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12">
      <div class="relative mx-auto size-44 shrink-0">
        <svg viewBox="0 0 160 160" class="size-full -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" :r="RING_RADIUS" fill="none" class="stroke-text/8" stroke-width="12" />
          <circle
            cx="80"
            cy="80"
            :r="RING_RADIUS"
            fill="none"
            class="stroke-chart-1"
            stroke-width="12"
            stroke-linecap="round"
            :stroke-dasharray="`${ringFill} ${RING_LENGTH}`"
          />
        </svg>
        <dl class="absolute inset-0 m-0 flex flex-col items-center justify-center text-center">
          <div class="flex flex-col-reverse items-center">
            <dt class="mt-1.5 text-sm text-text-muted" :title="t('widgets.PLAYER_SUMMARY.scoreRateHint')">
              {{ t("widgets.PLAYER_SUMMARY.scoreRate") }}
            </dt>
            <dd
              class="m-0 font-display text-figure leading-none font-semibold tracking-[-0.045em] text-text tabular-nums"
            >
              {{ formatPercent(data.scoreRate, locale.locale) }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="flex flex-col gap-8">
        <dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 xl:grid-cols-5">
          <div v-for="stat in stats" :key="stat.key" class="flex flex-col gap-1.5">
            <dt class="text-sm text-text-muted">{{ t(`widgets.PLAYER_SUMMARY.${stat.key}`) }}</dt>
            <dd
              class="m-0 font-display text-figure-sm leading-none font-semibold tracking-[-0.035em] text-text tabular-nums"
            >
              {{ stat.value }}
            </dd>
          </div>
        </dl>
        <div class="flex flex-col gap-2">
          <ResultLegend />
          <ResultSplitBar :tally="data" :label="t('widgets.PLAYER_SUMMARY.allGames')" />
        </div>
      </div>
    </div>
  </WidgetCard>
</template>
