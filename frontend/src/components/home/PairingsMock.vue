<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatResult } from "../../lib/format";
import LiveBadge from "./LiveBadge.vue";
import MockWindow from "./MockWindow.vue";
import { SAMPLE_PAIRINGS } from "./sampleTournament";

// The pairings of a published round: finished games with their result, one
// still in play, and the odd player out with the bye. On phones the color
// markers and the "playing" label go, so the names fit.
const { t } = useI18n();
</script>

<template>
  <MockWindow :title="t('home.mock.round')">
    <template #status>
      <span class="pill">{{ t("home.mock.published") }}</span>
    </template>
    <ul class="divide-y divide-border-soft">
      <li
        v-for="pairing in SAMPLE_PAIRINGS"
        :key="pairing.board"
        class="grid grid-cols-[1.25rem_1fr_auto_1fr] items-center gap-2.5 px-4 py-3 text-sm sm:grid-cols-[4rem_1fr_6.5rem_1fr] sm:gap-4 sm:px-5 sm:py-3.5 sm:text-[0.95rem]"
      >
        <span class="text-xs text-text-faint tabular-nums">
          <span class="hidden sm:inline">{{ t("home.mock.board") }}</span> {{ pairing.board }}
        </span>
        <span
          class="flex min-w-0 items-center justify-end gap-2"
          :class="{ 'font-semibold': pairing.result === '1-0' }"
        >
          <span class="truncate">{{ pairing.white }}</span>
          <span class="hidden size-2.5 shrink-0 rounded-[3px] border border-border bg-[#f7f3ea] sm:block" />
        </span>
        <span class="flex justify-center">
          <span v-if="pairing.result" class="font-display text-base whitespace-nowrap tabular-nums sm:text-lg">
            {{ formatResult(pairing.result) }}
          </span>
          <LiveBadge v-else-if="pairing.black" compact :label="t('home.mock.playing')" />
          <span v-else class="pill">{{ t("home.mock.bye") }}</span>
        </span>
        <span v-if="pairing.black" class="flex min-w-0 items-center gap-2">
          <span class="hidden size-2.5 shrink-0 rounded-[3px] border border-text-faint bg-[#211e18] sm:block" />
          <span class="truncate">{{ pairing.black }}</span>
        </span>
      </li>
    </ul>
  </MockWindow>
</template>
