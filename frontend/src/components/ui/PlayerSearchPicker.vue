<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { usePlayerSearch } from "../../lib/usePlayerSearch";
import type { PlayerSearchResult } from "../../services/players";

// The "find a player and add them" box of clubs (HU23), a coach's players
// (HU24) and tournament enrollment (HU07): the same search and list, with
// each page's own action. `pick` answers whether the player was added; the
// box clears only then, so a refusal keeps the search to try again.
const props = defineProps<{
  id: string;
  label: string;
  placeholder: string;
  actionLabel: string;
  addedLabel: string;
  isAdded: (player: PlayerSearchResult) => boolean;
  busy: boolean;
  pick: (player: PlayerSearchResult) => Promise<boolean>;
  disabled?: boolean;
}>();

const { t } = useI18n();
const { query, results, pending, status, reset } = usePlayerSearch();

async function onPick(player: PlayerSearchResult): Promise<void> {
  if (await props.pick(player)) reset();
}
</script>

<template>
  <div class="field relative">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="query"
      type="search"
      :name="id"
      autocomplete="off"
      spellcheck="false"
      :placeholder="placeholder"
      :disabled="disabled"
    />
    <p class="sr-only" role="status">{{ status }}</p>

    <ul
      v-if="query.trim() && !disabled"
      class="mt-2 list-none overflow-hidden rounded-lg border border-border-soft p-0"
    >
      <li v-if="pending" class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("playerSearch.searching") }}</li>
      <template v-else-if="results.length > 0">
        <li
          v-for="player in results"
          :key="player.id"
          class="flex items-center justify-between gap-3 border-b border-border-soft px-3.5 py-2.5 last:border-b-0"
        >
          <div class="flex flex-col gap-0.5">
            <strong class="text-text">{{ player.name }}</strong>
            <span class="text-sm text-text-muted">{{ player.universityCode }} · {{ player.program }}</span>
          </div>
          <button type="button" class="btn btn-ghost" :disabled="busy || isAdded(player)" @click="onPick(player)">
            {{ isAdded(player) ? addedLabel : actionLabel }}
          </button>
        </li>
      </template>
      <li v-else class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("playerSearch.noResults") }}</li>
    </ul>
  </div>
</template>
