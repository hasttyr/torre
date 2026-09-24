<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatPercent } from "../../../lib/format";
import { usePlayerWidgetData } from "../../../lib/useWidgetData";
import type { ResultsByColor } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import ResultLegend from "../../charts/ResultLegend.vue";
import ResultSplitBar from "../../charts/ResultSplitBar.vue";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload, subjectName } = usePlayerWidgetData<ResultsByColor>("PLAYER_RESULTS_BY_COLOR");

const COLORS = ["white", "black"] as const;

const hasGames = computed(() => COLORS.some((color) => data.value?.[color].scoreRate != null));
</script>

<template>
  <WidgetCard
    widget="PLAYER_RESULTS_BY_COLOR"
    :loading="loading"
    :error="error"
    :empty="!hasGames"
    :empty-message="data ? t('widgets.PLAYER_RESULTS_BY_COLOR.empty') : t('panel.noSubject')"
    :subject-name="subjectName"
    @retry="reload"
  >
    <div v-if="data" class="flex flex-col gap-4">
      <ResultLegend />
      <div v-for="color in COLORS" :key="color" class="flex items-end gap-4">
        <div class="min-w-0 flex-1">
          <ResultSplitBar :tally="data[color]" :label="t(`widgets.PLAYER_RESULTS_BY_COLOR.${color}`)" />
        </div>
        <div class="w-16 shrink-0 text-right">
          <p class="text-lg leading-none font-semibold text-text tabular-nums">
            {{ formatPercent(data[color].scoreRate, locale.locale) }}
          </p>
          <p class="text-[0.7rem] text-text-faint">{{ t("widgets.PLAYER_RESULTS_BY_COLOR.rate") }}</p>
        </div>
      </div>
    </div>
  </WidgetCard>
</template>
