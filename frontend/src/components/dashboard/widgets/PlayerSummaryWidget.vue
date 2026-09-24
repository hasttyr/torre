<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumber, formatPercent } from "../../../lib/format";
import { usePlayerWidgetData } from "../../../lib/useWidgetData";
import type { PlayerSummary } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import ResultLegend from "../../charts/ResultLegend.vue";
import ResultSplitBar from "../../charts/ResultSplitBar.vue";
import StatTile from "../StatTile.vue";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload, subjectName } = usePlayerWidgetData<PlayerSummary>("PLAYER_SUMMARY");

const tiles = computed(() => {
  const summary = data.value;
  if (!summary) return [];
  return [
    {
      key: "scoreRate",
      value: formatPercent(summary.scoreRate, locale.locale),
      hint: t("widgets.PLAYER_SUMMARY.scoreRateHint"),
    },
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
    <div v-if="data" class="flex flex-col gap-5">
      <dl class="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          v-for="tile in tiles"
          :key="tile.key"
          :label="t(`widgets.PLAYER_SUMMARY.${tile.key}`)"
          :value="tile.value"
          :hint="tile.hint"
        />
      </dl>
      <div class="flex flex-col gap-2">
        <ResultLegend />
        <ResultSplitBar :tally="data" :label="t('widgets.PLAYER_SUMMARY.allGames')" />
      </div>
    </div>
  </WidgetCard>
</template>
