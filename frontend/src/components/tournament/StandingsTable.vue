<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatNumber } from "../../lib/format";
import type { Standings } from "../../services/rounds";
import { useLocaleStore } from "../../stores/locale";

// HU14: the official standings, with the tiebreak columns that decide ties.
defineProps<{ standings: Standings }>();

const { t } = useI18n();
const locale = useLocaleStore();
// Two decimals: Sonneborn-Berger can land on quarters (0.5 × 0.5).
const number = (value: number): string => formatNumber(value, locale.locale, 2);
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
            <th class="border-b border-border-soft px-2 py-2 font-semibold">#</th>
            <th class="border-b border-border-soft px-2 py-2 font-semibold">{{ t("standings.player") }}</th>
            <th class="border-b border-border-soft px-2 py-2 text-right font-semibold">{{ t("standings.points") }}</th>
            <th class="border-b border-border-soft px-2 py-2 text-right font-semibold" :title="t('standings.buchholz')">
              BH
            </th>
            <th class="border-b border-border-soft px-2 py-2 text-right font-semibold" :title="t('standings.cut1')">
              BC1
            </th>
            <th class="border-b border-border-soft px-2 py-2 text-right font-semibold" :title="t('standings.sb')">
              SB
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in standings.rows" :key="row.playerId" :class="{ 'opacity-60': row.withdrawn }">
            <td class="border-b border-border-soft px-2 py-2 font-semibold text-text tabular-nums">{{ row.rank }}</td>
            <td class="border-b border-border-soft px-2 py-2 text-text">
              {{ row.name }}
              <span v-if="row.withdrawn" class="ml-1 text-xs text-text-faint">({{ t("standings.withdrawn") }})</span>
            </td>
            <td class="border-b border-border-soft px-2 py-2 text-right font-semibold text-text tabular-nums">
              {{ number(row.score) }}
            </td>
            <td class="border-b border-border-soft px-2 py-2 text-right tabular-nums">{{ number(row.buchholz) }}</td>
            <td class="border-b border-border-soft px-2 py-2 text-right tabular-nums">
              {{ number(row.buchholzCut1) }}
            </td>
            <td class="border-b border-border-soft px-2 py-2 text-right tabular-nums">
              {{ number(row.sonnebornBerger) }}
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
