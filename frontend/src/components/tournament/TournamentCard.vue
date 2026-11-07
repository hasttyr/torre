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
    class="group flex flex-col items-start gap-3 rounded-[24px] pane p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7"
    :class="
      to
        ? 'text-inherit no-underline transition-[translate,scale] duration-300 ease-spring hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:hover:translate-y-0'
        : ''
    "
  >
    <div class="flex flex-col gap-1">
      <component :is="heading" class="text-xl tracking-[-0.02em] sm:text-title">{{ tournament.name }}</component>
      <p class="text-body-sm tabular-nums">
        {{ formatDate(tournament.startDate, locale.locale) }} —
        {{ formatDate(tournament.endDate, locale.locale) }}
      </p>
      <slot />
    </div>
    <span class="pill shrink-0">{{ t(`estados.${tournament.status}`) }}</span>
  </component>
</template>
