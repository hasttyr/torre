<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

import { formatDate } from "../../lib/format";
import type { Tournament } from "../../services/tournaments";
import { useLocaleStore } from "../../stores/locale";

// A tournament in a list (organizer's, live, a player's, a coach's): name,
// dates and state. With `to`, the whole card is the link to it; otherwise
// the page adds its own actions in the slot (never a link inside a link).
const props = withDefaults(
  defineProps<{
    tournament: Pick<Tournament, "name" | "startDate" | "endDate" | "status">;
    to?: string;
    headingLevel?: 2 | 3;
  }>(),
  { to: undefined, headingLevel: 3 },
);

const { t } = useI18n();
const locale = useLocaleStore();
const heading = computed(() => `h${props.headingLevel}`);
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    :class="to ? 'text-inherit no-underline transition-colors hover:border-accent/40' : ''"
  >
    <div class="flex flex-col gap-0.5">
      <component :is="heading" class="text-base">{{ tournament.name }}</component>
      <p class="text-sm">
        {{ formatDate(tournament.startDate, locale.locale) }} —
        {{ formatDate(tournament.endDate, locale.locale) }}
      </p>
      <slot />
    </div>
    <span class="pill shrink-0">{{ t(`estados.${tournament.status}`) }}</span>
  </component>
</template>
