<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatDate } from "../../../lib/format";
import { hasTournamentRoom } from "../../../lib/tournamentAccess";
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
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="tournament in data"
        :key="tournament.id"
        class="relative flex items-center gap-4 rounded-[20px] bg-surface-2 px-3.5 py-3.5 transition-colors hover:bg-text/6"
      >
        <div
          class="flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-chart-1/15 leading-none"
          aria-hidden="true"
        >
          <span class="font-display text-[1.375rem] font-semibold tracking-[-0.03em] text-text tabular-nums">{{
            dayParts(tournament.startDate).day
          }}</span>
          <span class="text-xs font-semibold text-text-muted">
            {{ dayParts(tournament.startDate).month }}
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <RouterLink
            v-if="hasTournamentRoom(tournament)"
            :to="`/torneos/${tournament.id}/sala`"
            class="block truncate text-[1.0625rem] font-semibold text-text no-underline after:absolute after:inset-0 hover:text-accent"
          >
            {{ tournament.name }}
          </RouterLink>
          <p v-else class="truncate text-[1.0625rem] font-semibold text-text">{{ tournament.name }}</p>
          <p class="mt-0.5 text-[0.84rem] tabular-nums">
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
