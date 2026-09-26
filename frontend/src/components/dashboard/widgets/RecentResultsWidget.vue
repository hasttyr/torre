<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatDateTime, formatResult } from "../../../lib/format";
import { useWidgetData } from "../../../lib/useWidgetData";
import type { RecentResult } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload } = useWidgetData<RecentResult[]>("RECENT_RESULTS");
</script>

<template>
  <WidgetCard
    widget="RECENT_RESULTS"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="t('widgets.RECENT_RESULTS.empty')"
    @retry="reload"
  >
    <ul class="m-0 flex list-none flex-col p-0">
      <li
        v-for="result in data"
        :key="result.id"
        class="flex flex-col gap-1 border-b border-border-soft py-2.5 first:pt-0 last:border-b-0 last:pb-0"
      >
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
          <span
            class="truncate text-right"
            :class="result.value === '1-0' ? 'font-semibold text-text' : 'text-text-muted'"
          >
            {{ result.white }}
          </span>
          <span class="rounded-md bg-surface-2 px-2 py-0.5 font-semibold text-text tabular-nums">
            {{ formatResult(result.value) }}
          </span>
          <span class="truncate" :class="result.value === '0-1' ? 'font-semibold text-text' : 'text-text-muted'">
            {{ result.black }}
          </span>
        </div>
        <p class="text-center text-xs text-text-faint">
          {{
            t("widgets.RECENT_RESULTS.meta", {
              tournament: result.tournamentName,
              round: result.round,
              board: result.board,
            })
          }}
          · {{ formatDateTime(result.recordedAt, locale.locale) }}
        </p>
      </li>
    </ul>
  </WidgetCard>
</template>
