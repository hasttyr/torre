<script setup lang="ts">
import { createColumnHelper } from "@tanstack/vue-table";
import { h } from "vue";
import { useI18n } from "vue-i18n";

import { formatPercent } from "../../../lib/format";
import { usePlayerSelection } from "../../../lib/playerSelection";
import { useWidgetData } from "../../../lib/useWidgetData";
import type { PlayerOverviewRow } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import ResultLegend from "../../charts/ResultLegend.vue";
import ResultSplitBar from "../../charts/ResultSplitBar.vue";
import DataTable from "../../ui/DataTable.vue";
import PlayerName from "../PlayerName.vue";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const selection = usePlayerSelection();
const { data, loading, error, reload } = useWidgetData<PlayerOverviewRow[]>("PLAYERS_OVERVIEW");

const column = createColumnHelper<PlayerOverviewRow>();

const columns = [
  column.accessor("name", {
    header: () => t("widgets.PLAYERS_OVERVIEW.player"),
    cell: ({ row }) =>
      h("div", { class: "flex flex-col" }, [
        h(PlayerName, { playerId: row.original.playerId, name: row.original.name }),
        h("span", { class: "text-xs text-text-faint" }, row.original.program),
      ]),
  }),
  column.accessor("tournaments", { header: () => t("widgets.PLAYERS_OVERVIEW.tournaments") }),
  column.accessor("games", { header: () => t("widgets.PLAYERS_OVERVIEW.games") }),
  column.display({
    id: "results",
    header: () => t("widgets.PLAYERS_OVERVIEW.results"),
    cell: ({ row }) =>
      h("div", { class: "flex min-w-[8rem] flex-col gap-1" }, [
        h(ResultSplitBar, { tally: row.original, compact: true }),
        h(
          "span",
          { class: "text-xs text-text-muted tabular-nums" },
          t("widgets.results.summary", {
            wins: row.original.wins,
            draws: row.original.draws,
            losses: row.original.losses,
          }),
        ),
      ]),
  }),
  column.accessor("scoreRate", {
    header: () => t("widgets.PLAYERS_OVERVIEW.scoreRate"),
    sortUndefined: "last",
    cell: ({ getValue }) => h("strong", { class: "text-text tabular-nums" }, formatPercent(getValue(), locale.locale)),
  }),
];
</script>

<template>
  <WidgetCard
    widget="PLAYERS_OVERVIEW"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="t('widgets.PLAYERS_OVERVIEW.empty')"
    @retry="reload"
  >
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <ResultLegend />
        <p v-if="selection.enabled.value" class="text-xs text-text-faint">
          {{ t("widgets.selectHint") }}
        </p>
      </div>
      <DataTable
        :columns="columns"
        :data="data ?? []"
        :searchable="(data?.length ?? 0) > 8"
        :page-size="8"
        :search-placeholder="t('widgets.PLAYERS_OVERVIEW.search')"
      />
    </div>
  </WidgetCard>
</template>
