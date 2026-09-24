<script setup lang="ts">
import { createColumnHelper } from "@tanstack/vue-table";
import { h } from "vue";
import { useI18n } from "vue-i18n";

import { formatDate, formatNumber } from "../../../lib/format";
import { usePlayerWidgetData } from "../../../lib/useWidgetData";
import type { TournamentHistoryEntry } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import DataTable from "../../ui/DataTable.vue";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload, subjectName } =
  usePlayerWidgetData<TournamentHistoryEntry[]>("PLAYER_TOURNAMENT_HISTORY");

const column = createColumnHelper<TournamentHistoryEntry>();

const columns = [
  column.accessor("name", {
    header: () => t("widgets.PLAYER_TOURNAMENT_HISTORY.tournament"),
    cell: ({ row }) =>
      h("div", { class: "flex flex-col" }, [
        h("span", { class: "font-semibold text-text" }, row.original.name),
        h("span", { class: "text-xs text-text-faint" }, formatDate(row.original.startDate, locale.locale)),
      ]),
  }),
  column.accessor("status", {
    header: () => t("widgets.PLAYER_TOURNAMENT_HISTORY.status"),
    cell: ({ row }) =>
      h(
        "span",
        { class: "pill" },
        row.original.withdrawn ? t("widgets.PLAYER_TOURNAMENT_HISTORY.withdrawn") : t(`estados.${row.original.status}`),
      ),
  }),
  column.accessor("rank", {
    header: () => t("widgets.PLAYER_TOURNAMENT_HISTORY.rank"),
    // Unranked (not started) sorts last whichever the direction.
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.rank === null
        ? "—"
        : h("span", { class: "tabular-nums" }, [
            h("strong", { class: "text-text" }, t("widgets.ordinal", { n: row.original.rank })),
            ` / ${row.original.participants}`,
          ]),
  }),
  column.accessor("points", {
    header: () => t("widgets.PLAYER_TOURNAMENT_HISTORY.points"),
    cell: ({ getValue }) => {
      const points = getValue();
      return points === null ? "—" : formatNumber(points, locale.locale);
    },
  }),
  column.accessor("buchholz", {
    header: () => "Buchholz",
    cell: ({ getValue }) => {
      const buchholz = getValue();
      return buchholz === null ? "—" : formatNumber(buchholz, locale.locale);
    },
  }),
];
</script>

<template>
  <WidgetCard
    widget="PLAYER_TOURNAMENT_HISTORY"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="data ? t('widgets.PLAYER_TOURNAMENT_HISTORY.empty') : t('panel.noSubject')"
    :subject-name="subjectName"
    @retry="reload"
  >
    <DataTable
      :columns="columns"
      :data="data ?? []"
      :searchable="(data?.length ?? 0) > 6"
      :page-size="6"
      :search-placeholder="t('widgets.PLAYER_TOURNAMENT_HISTORY.search')"
    />
  </WidgetCard>
</template>
