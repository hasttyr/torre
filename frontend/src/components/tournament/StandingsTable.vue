<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatNumber } from "../../lib/format";
import type { StandingRow, Standings } from "../../services/rounds";
import { useLocaleStore } from "../../stores/locale";

// HU14: the official standings, with the tiebreak columns that decide ties.
defineProps<{ standings: Standings }>();

const { t } = useI18n();
const locale = useLocaleStore();
// Two decimals: Sonneborn-Berger can land on quarters (0.5 × 0.5).
const number = (value: number): string => formatNumber(value, locale.locale, 2);

// Standard FIDE abbreviations. Each header shows the abbreviation (its
// full name on hover) and gives screen readers the full name instead.
const TIEBREAKS: { short: string; nameKey: string; value: (row: StandingRow) => number }[] = [
  { short: "BH", nameKey: "standings.buchholz", value: (row) => row.buchholz },
  { short: "BC1", nameKey: "standings.cut1", value: (row) => row.buchholzCut1 },
  { short: "SB", nameKey: "standings.sb", value: (row) => row.sonnebornBerger },
];

const HEADER = "border-b border-border-soft px-2 py-2 font-semibold";
const CELL = "border-b border-border-soft px-2 py-2";
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="standings.pending" class="banner border-border bg-surface-2 text-text-muted" role="status">
      {{ t("standings.pending") }}
    </p>

    <p v-if="standings.rows.length === 0" class="text-sm text-text-muted">{{ t("standings.empty") }}</p>

    <div v-else class="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="text-left text-text-muted">
            <th scope="col" :class="HEADER">
              <span aria-hidden="true">#</span>
              <span class="sr-only">{{ t("standings.rank") }}</span>
            </th>
            <th scope="col" :class="HEADER">{{ t("standings.player") }}</th>
            <th scope="col" :class="[HEADER, 'text-right']">
              <abbr :title="t('standings.pointsName')" aria-hidden="true" class="no-underline">
                {{ t("standings.points") }}
              </abbr>
              <span class="sr-only">{{ t("standings.pointsName") }}</span>
            </th>
            <th v-for="tiebreak in TIEBREAKS" :key="tiebreak.short" scope="col" :class="[HEADER, 'text-right']">
              <abbr :title="t(tiebreak.nameKey)" aria-hidden="true" class="no-underline">{{ tiebreak.short }}</abbr>
              <span class="sr-only">{{ t(tiebreak.nameKey) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in standings.rows" :key="row.playerId" :class="{ 'opacity-60': row.withdrawn }">
            <td :class="[CELL, 'font-semibold text-text tabular-nums']">{{ row.rank }}</td>
            <td :class="[CELL, 'text-text']">
              {{ row.name }}
              <span v-if="row.withdrawn" class="ml-1 text-xs text-text-faint">({{ t("standings.withdrawn") }})</span>
            </td>
            <td :class="[CELL, 'text-right font-semibold text-text tabular-nums']">{{ number(row.score) }}</td>
            <td v-for="tiebreak in TIEBREAKS" :key="tiebreak.short" :class="[CELL, 'text-right tabular-nums']">
              {{ number(tiebreak.value(row)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="standings.tiebreaks.length > 0" class="text-xs text-text-faint">
      {{ t("standings.tiebreakOrder", { order: standings.tiebreaks.join(" › ") }) }}
    </p>
  </div>
</template>
