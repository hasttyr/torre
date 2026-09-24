<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumber, formatPercent, formatShortDate } from "../../../lib/format";
import { usePlayerWidgetData } from "../../../lib/useWidgetData";
import type { PerformancePoint } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import LineChart from "../../charts/LineChart.vue";
import type { LinePoint } from "../../charts/types";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload, subjectName } =
  usePlayerWidgetData<PerformancePoint[]>("PLAYER_PERFORMANCE_TREND");

const points = computed((): LinePoint[] =>
  (data.value ?? []).map((point) => ({
    key: point.tournamentId,
    label: formatShortDate(point.startDate, locale.locale),
    value: point.scoreRate,
    tooltip: [
      point.name,
      t("widgets.PLAYER_PERFORMANCE_TREND.tooltipRate", { rate: formatPercent(point.scoreRate, locale.locale) }),
      t("widgets.PLAYER_PERFORMANCE_TREND.tooltipRank", { rank: point.rank, total: point.participants }),
      t("widgets.PLAYER_PERFORMANCE_TREND.tooltipPoints", {
        points: formatNumber(point.points, locale.locale),
        games: point.games,
      }),
    ],
  })),
);

const formatValue = (value: number): string => formatPercent(value, locale.locale);
</script>

<template>
  <WidgetCard
    widget="PLAYER_PERFORMANCE_TREND"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="data ? t('widgets.PLAYER_PERFORMANCE_TREND.empty') : t('panel.noSubject')"
    :subject-name="subjectName"
    @retry="reload"
  >
    <LineChart :points="points" :format-value="formatValue" :label="t('widgets.PLAYER_PERFORMANCE_TREND.title')" />
  </WidgetCard>
</template>
