<script setup lang="ts">
import { TOURNAMENT_STATUSES, type TournamentStatus } from "@contracts";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { useWidgetData } from "../../../lib/useWidgetData";
import type { TournamentStatusCount } from "../../../services/dashboard";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const { data, loading, error, reload } = useWidgetData<TournamentStatusCount[]>("TOURNAMENTS_BY_STATUS");

// A tournament's life is a sequence (created → registration → play →
// finished), so the counts are drawn as that pipeline, in the catalog's
// order, with every stage shown: a stage with no tournaments prints 0
// rather than disappearing. One hue, deepening as the stages advance.
const STAGE_TONES = [0.3, 0.45, 0.6, 0.8, 1];

const stages = computed(() => {
  const counts = new Map<TournamentStatus, number>((data.value ?? []).map((row) => [row.status, row.count]));
  return TOURNAMENT_STATUSES.map((status, index) => ({
    status,
    count: counts.get(status) ?? 0,
    tone: STAGE_TONES[index]!,
  }));
});

const total = computed(() => stages.value.reduce((sum, stage) => sum + stage.count, 0));
</script>

<template>
  <WidgetCard
    widget="TOURNAMENTS_BY_STATUS"
    :loading="loading"
    :error="error"
    :empty="total === 0"
    :empty-message="t('widgets.TOURNAMENTS_BY_STATUS.empty')"
    @retry="reload"
  >
    <div class="flex flex-col gap-7">
      <p class="flex items-baseline gap-3">
        <strong class="figure">{{ total }}</strong>
        <span class="text-text-muted">{{ t("widgets.TOURNAMENTS_BY_STATUS.total") }}</span>
      </p>

      <!-- The stages top to bottom, each with its count and a bar of its
           share of all tournaments. -->
      <ol class="m-0 flex list-none flex-col gap-2 p-0" :aria-label="t('widgets.TOURNAMENTS_BY_STATUS.title')">
        <li
          v-for="stage in stages"
          :key="stage.status"
          class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2.5 rounded-[18px] bg-surface-2 px-4 py-3.5"
        >
          <span class="text-[0.95rem] text-text">{{ t(`estados.${stage.status}`) }}</span>
          <strong
            class="font-display text-[1.5rem] leading-none font-semibold tracking-[-0.03em] tabular-nums"
            :class="stage.count === 0 ? 'text-text-faint' : 'text-text'"
          >
            {{ stage.count }}
          </strong>
          <span class="col-span-2 h-1.5 overflow-hidden rounded-full bg-text/6" aria-hidden="true">
            <span
              class="block h-full min-w-1 rounded-full bg-chart-1"
              :style="{ width: `${(stage.count / total) * 100}%`, opacity: stage.count === 0 ? 0 : stage.tone }"
            />
          </span>
        </li>
      </ol>
    </div>
  </WidgetCard>
</template>
