<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatResult } from "../../lib/format";
import MockWindow from "./MockWindow.vue";

// A corrected result: what it was, what it is now, who changed it, and the
// standings recalculated from it.
const { t } = useI18n();
</script>

<template>
  <MockWindow :title="t('home.mock.corrected')">
    <template #status>
      <span class="text-xs whitespace-nowrap text-text-faint">{{ t("home.mock.board") }} 2</span>
    </template>
    <div class="flex flex-col items-center gap-3 px-4 py-6 sm:px-5">
      <div class="flex w-full items-center justify-between gap-3 text-sm text-text-muted">
        <span class="truncate">C. Duarte</span>
        <span class="truncate">A. Ortiz</span>
      </div>
      <div class="flex items-center gap-3 font-display whitespace-nowrap tabular-nums">
        <s class="text-lg text-text-faint">{{ formatResult("0-1") }}</s>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" class="shrink-0 text-text-faint">
          <path d="M4 12h15m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        </svg>
        <span class="text-3xl text-text">{{ formatResult("1/2-1/2") }}</span>
      </div>
    </div>
    <div class="flex flex-col gap-1.5 border-t border-border-soft px-4 py-3 text-xs sm:px-5">
      <span class="text-text-muted">{{ t("home.mock.correctedBy") }}</span>
      <span class="inline-flex items-center gap-1.5 font-semibold text-success">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" class="shrink-0">
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        </svg>
        {{ t("home.mock.recalculated") }}
      </span>
    </div>
  </MockWindow>
</template>
