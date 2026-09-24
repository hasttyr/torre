<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatDate } from "../../../lib/format";
import { useWidgetData } from "../../../lib/useWidgetData";
import type { UpcomingTournament } from "../../../services/dashboard";
import { useLocaleStore } from "../../../stores/locale";
import WidgetCard from "../WidgetCard.vue";

const { t } = useI18n();
const locale = useLocaleStore();
const { data, loading, error, reload } = useWidgetData<UpcomingTournament[]>("UPCOMING_TOURNAMENTS");

/** Day and month of a date-only value, split for the calendar badge. */
function dayParts(date: string): { day: string; month: string } {
  const value = new Date(date);
  return {
    day: value.toLocaleDateString(locale.locale, { day: "2-digit", timeZone: "UTC" }),
    month: value.toLocaleDateString(locale.locale, { month: "short", timeZone: "UTC" }),
  };
}
</script>

<template>
  <WidgetCard
    widget="UPCOMING_TOURNAMENTS"
    :loading="loading"
    :error="error"
    :empty="!data || data.length === 0"
    :empty-message="t('widgets.UPCOMING_TOURNAMENTS.empty')"
    @retry="reload"
  >
    <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
      <li
        v-for="tournament in data"
        :key="tournament.id"
        class="flex items-center gap-3.5 rounded-2xl border border-border-soft px-3.5 py-3"
      >
        <div
          class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent/12 leading-none"
          aria-hidden="true"
        >
          <span class="text-lg font-semibold text-text">{{ dayParts(tournament.startDate).day }}</span>
          <span class="text-[0.65rem] font-semibold text-text-muted uppercase">
            {{ dayParts(tournament.startDate).month }}
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-text">{{ tournament.name }}</p>
          <p class="text-xs">
            {{ formatDate(tournament.startDate, locale.locale) }} —
            {{ formatDate(tournament.endDate, locale.locale) }} ·
            {{ t("widgets.UPCOMING_TOURNAMENTS.enrolled", { count: tournament.enrolled }, tournament.enrolled) }}
          </p>
        </div>
        <span class="pill hidden sm:inline-flex">{{ t(`estados.${tournament.status}`) }}</span>
      </li>
    </ul>
  </WidgetCard>
</template>
