<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { formatResult } from "../../lib/format";
import { GAME_RESULTS, type GameResult } from "../../services/rounds";

// The three outcomes a game can have (RN-03), as one-tap buttons.
defineProps<{ current?: string | null; disabled?: boolean }>();
defineEmits<{ pick: [value: GameResult] }>();

const { t } = useI18n();

// Spoken names for screen readers ("1-0" alone reads poorly).
const NAME_KEYS: Record<GameResult, string> = { "1-0": "whiteWins", "1/2-1/2": "draw", "0-1": "blackWins" };
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-lg border border-border"
    role="group"
    :aria-label="t('rounds.resultLabel')"
  >
    <button
      v-for="value in GAME_RESULTS"
      :key="value"
      type="button"
      class="border-l border-border px-2.5 py-1.5 text-sm font-semibold tabular-nums transition-colors first:border-l-0 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
      :class="current === value ? 'bg-accent text-[#17130a] hover:bg-accent' : 'text-text'"
      :aria-label="t(`rounds.resultNames.${NAME_KEYS[value]}`)"
      :aria-pressed="current === value"
      :disabled="disabled"
      @click="$emit('pick', value)"
    >
      {{ formatResult(value) }}
    </button>
  </div>
</template>
