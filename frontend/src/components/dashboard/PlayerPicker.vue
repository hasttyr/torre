<script setup lang="ts">
import { useId } from "vue";
import { useI18n } from "vue-i18n";

import { usePlayerSelection } from "../../lib/playerSelection";

// Picks the player every "per player" widget on the dashboard shows.
const { t } = useI18n();
const selection = usePlayerSelection();
const selectId = useId();

function onChange(event: Event): void {
  selection.select((event.target as HTMLSelectElement).value);
}
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-2xl border border-border-soft bg-bg-elevated/90 px-4 py-3 shadow-md backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
  >
    <label :for="selectId" class="text-sm font-semibold text-text-muted">{{ t("panel.subjectLabel") }}</label>
    <select
      :id="selectId"
      class="select-compact min-w-0 sm:w-72"
      :value="selection.selectedId.value ?? ''"
      @change="onChange"
    >
      <option v-for="player in selection.players.value" :key="player.id" :value="player.id">
        {{ player.name }}
      </option>
    </select>
  </div>
</template>
