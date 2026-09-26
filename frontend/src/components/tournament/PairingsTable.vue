<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatResult } from "../../lib/format";
import type { Match, Round } from "../../services/rounds";

// A round's boards: who plays whom, with which color, and the result.
// Purely presentational; whatever a viewer may DO with a board (record,
// correct) comes in through the `actions` slot, so the same table serves
// the draft review, the public room and the arbiter's result entry.
defineProps<{ round: Round }>();
defineSlots<{ actions?: (props: { match: Match }) => unknown }>();

const { t } = useI18n();

function isWinner(match: Match, side: "white" | "black"): boolean {
  return (side === "white" && match.result === "1-0") || (side === "black" && match.result === "0-1");
}
</script>

<template>
  <ol class="m-0 flex list-none flex-col gap-2 p-0">
    <li
      v-for="match in round.matches"
      :key="match.id"
      class="flex flex-col gap-2 rounded-2xl border border-border-soft px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4"
      :data-match="match.id"
    >
      <span class="text-xs font-semibold tracking-wide text-text-faint uppercase sm:w-14">
        {{ t("rounds.board", { board: match.board }) }}
      </span>

      <template v-if="match.isBye">
        <p class="flex-1 text-sm">
          <strong class="text-text">{{ match.white?.name }}</strong>
          {{ t("rounds.byeLabel") }}
        </p>
        <span class="pill">{{ t("rounds.bye") }}</span>
      </template>

      <template v-else>
        <div class="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
          <!-- The swatch shows each side's color; screen readers get it as text,
               since an aria-label on a role-less <span> is never read. -->
          <span class="flex min-w-0 items-center justify-end gap-2 text-right">
            <span class="truncate" :class="isWinner(match, 'white') ? 'font-semibold text-text' : 'text-text-muted'">
              {{ match.white?.name }}
            </span>
            <span class="sr-only">({{ t("rounds.white") }})</span>
            <span
              class="h-3 w-3 shrink-0 rounded-sm border border-border bg-white"
              :title="t('rounds.white')"
              aria-hidden="true"
            />
          </span>
          <span
            class="min-w-16 rounded-md px-2 py-0.5 text-center font-semibold tabular-nums"
            :class="match.result ? 'bg-surface-2 text-text' : 'text-text-faint'"
          >
            {{ match.result ? formatResult(match.result) : t("rounds.vs") }}
          </span>
          <span class="flex min-w-0 items-center gap-2">
            <span
              class="h-3 w-3 shrink-0 rounded-sm border border-border bg-[#1f1f1f]"
              :title="t('rounds.black')"
              aria-hidden="true"
            />
            <span class="truncate" :class="isWinner(match, 'black') ? 'font-semibold text-text' : 'text-text-muted'">
              {{ match.black?.name }}
            </span>
            <span class="sr-only">({{ t("rounds.black") }})</span>
          </span>
        </div>
        <div v-if="$slots.actions" class="sm:shrink-0">
          <slot name="actions" :match="match" />
        </div>
      </template>
    </li>
  </ol>
</template>
