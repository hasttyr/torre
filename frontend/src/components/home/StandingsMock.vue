<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatNumber } from "../../lib/format";
import LiveBadge from "./LiveBadge.vue";
import MockWindow from "./MockWindow.vue";
import { SAMPLE_STANDINGS } from "./sampleTournament";

// Live standings with their tiebreaks; each player's bar is their share of
// the points played so far, and fills in when the tile scrolls into view.
const { t, locale } = useI18n();

const ROUNDS_PLAYED = 3;
const number = (value: number) => formatNumber(value, locale.value);
</script>

<template>
  <MockWindow :title="t('home.mock.standings')">
    <template #status>
      <LiveBadge :label="t('home.mock.live')" />
    </template>
    <table class="w-full text-sm sm:text-[0.95rem]">
      <thead class="text-xs text-text-faint">
        <tr>
          <th class="py-2.5 pl-4 text-left font-normal sm:pl-5">#</th>
          <th class="text-left font-normal">{{ t("home.mock.player") }}</th>
          <th class="px-2 text-right font-normal">{{ t("home.mock.points") }}</th>
          <th class="px-2 text-right font-normal">Bh</th>
          <th class="hidden pr-5 pl-2 text-right font-normal sm:table-cell">SB</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in SAMPLE_STANDINGS"
          :key="row.name"
          class="border-t border-border-soft"
          :class="{ 'bg-accent/10': index === 0 }"
        >
          <td
            class="py-3 pl-4 tabular-nums sm:pl-5"
            :class="index === 0 ? 'font-semibold text-accent' : 'text-text-faint'"
          >
            {{ index + 1 }}
          </td>
          <td class="py-3 pr-2">
            <span class="block truncate" :class="{ 'font-semibold': index === 0 }">{{ row.name }}</span>
            <span class="mt-1.5 hidden h-1 w-full max-w-40 overflow-hidden rounded-full bg-border-soft sm:block">
              <span
                class="block h-full w-(--fill) rounded-full bg-accent transition-[width] delay-300 duration-1000 ease-out group-data-[revealed=false]/render:w-0"
                :style="{ '--fill': `${(row.points / ROUNDS_PLAYED) * 100}%` }"
              />
            </span>
          </td>
          <td class="px-2 text-right font-semibold tabular-nums">{{ number(row.points) }}</td>
          <td class="px-2 text-right text-text-muted tabular-nums">{{ number(row.buchholz) }}</td>
          <td class="hidden pr-5 pl-2 text-right text-text-muted tabular-nums sm:table-cell">
            {{ number(row.sonneborn) }}
          </td>
        </tr>
      </tbody>
    </table>
  </MockWindow>
</template>
