<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatLocalDate } from "../../../lib/format";
import { usePlayerWidgetData } from "../../../lib/useWidgetData";
import type { GameLogEntry } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import DataTable from "../../ui/DataTable.vue";
import WidgetCard from "../WidgetCard.vue";
import { dataTableColumns } from "../../ui/dataTableFeatures";

// HU15: the player's games one by one — tournament, round, color, opponent
// and outcome — complementing the per-tournament history.
const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload, subjectName } = usePlayerWidgetData<GameLogEntry[]>("PLAYER_GAME_LOG");

// Outcome from the player's side: the same diverging scale as every other
// result chart (blue win, gray draw, red loss), always next to its label.
const OUTCOME_SWATCH: Record<GameLogEntry["outcome"], string> = {
  WIN: "bg-chart-win",
  DRAW: "bg-chart-draw",
  LOSS: "bg-chart-loss",
  BYE: "bg-surface-2 border border-border",
};

const column = dataTableColumns<GameLogEntry>();

const columns = [
  // Rendered by the template (#cell-tournamentName): the tournament, with the round and day.
  column.accessor("tournamentName", { header: () => t("widgets.PLAYER_GAME_LOG.tournament") }),
  column.accessor("color", {
    header: () => t("widgets.PLAYER_GAME_LOG.color"),
    cell: ({ getValue }) => {
      const color = getValue();
      return color ? t(`widgets.PLAYER_GAME_LOG.colors.${color}`) : "—";
    },
  }),
  column.accessor("opponent", {
    header: () => t("widgets.PLAYER_GAME_LOG.opponent"),
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  // Rendered by the template (#cell-outcome): a swatch and the outcome's name.
  column.accessor("outcome", { header: () => t("widgets.PLAYER_GAME_LOG.outcome") }),
];
</script>

<template>
  <WidgetCard
    widget="PLAYER_GAME_LOG"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="data ? t('widgets.PLAYER_GAME_LOG.empty') : t('panel.noSubject')"
    :subject-name="subjectName"
    @retry="reload"
  >
    <DataTable
      :columns="columns"
      :data="data ?? []"
      :searchable="(data?.length ?? 0) > 8"
      :page-size="8"
      :search-placeholder="t('widgets.PLAYER_GAME_LOG.search')"
    >
      <template #cell-tournamentName="{ row }">
        <div class="flex flex-col">
          <span class="font-semibold text-text">{{ row.tournamentName }}</span>
          <span class="text-xs text-text-faint">
            {{ t("widgets.PLAYER_GAME_LOG.round", { round: row.round }) }} ·
            {{ formatLocalDate(row.recordedAt, locale.locale) }}
          </span>
        </div>
      </template>
      <template #cell-outcome="{ row }">
        <span class="inline-flex items-center gap-1.5 font-semibold text-text">
          <span class="inline-block h-2.5 w-2.5 rounded-sm" :class="OUTCOME_SWATCH[row.outcome]" aria-hidden="true" />
          {{ t(`widgets.PLAYER_GAME_LOG.outcomes.${row.outcome}`) }}
        </span>
      </template>
    </DataTable>
  </WidgetCard>
</template>
