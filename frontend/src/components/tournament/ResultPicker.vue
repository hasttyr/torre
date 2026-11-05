<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatResult } from "../../lib/format";
import { FORFEIT_RESULTS, PLAYED_RESULTS, type GameResult } from "../../services/rounds";

// The outcomes a game can have (RN-03), as one-tap buttons: the three of a
// game played, and apart, the forfeits of one that wasn't (decision 011).
defineProps<{ current?: string | null; disabled?: boolean }>();
defineEmits<{ pick: [value: GameResult] }>();

const { t } = useI18n();

// Spoken names for screen readers ("1-0" alone reads poorly).
const NAME_KEYS: Record<GameResult, string> = {
  "1-0": "whiteWins",
  "1/2-1/2": "draw",
  "0-1": "blackWins",
  "1F-0F": "blackForfeits",
  "0F-1F": "whiteForfeits",
  "0F-0F": "doubleForfeit",
};

const GROUPS = [
  { labelKey: "rounds.resultLabel", values: PLAYED_RESULTS, size: "px-2.5 py-1.5 text-sm" },
  { labelKey: "rounds.forfeitLabel", values: FORFEIT_RESULTS, size: "px-2 py-1 text-xs" },
] as const;
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-2">
    <div
      v-for="group in GROUPS"
      :key="group.labelKey"
      class="inline-flex overflow-hidden rounded-lg border border-border"
      role="group"
      :aria-label="t(group.labelKey)"
    >
      <button
        v-for="value in group.values"
        :key="value"
        type="button"
        class="border-l border-border font-semibold tabular-nums transition-colors first:border-l-0 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
        :class="[group.size, current === value ? 'bg-accent text-on-accent hover:bg-accent' : 'text-text']"
        :aria-label="t(`rounds.resultNames.${NAME_KEYS[value]}`)"
        :aria-pressed="current === value"
        :disabled="disabled"
        @click="$emit('pick', value)"
      >
        {{ formatResult(value) }}
      </button>
    </div>
  </div>
</template>
