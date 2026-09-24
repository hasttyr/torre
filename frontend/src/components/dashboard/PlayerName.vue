<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { usePlayerSelection } from "../../lib/playerSelection";

// A player's name inside a list widget. When the dashboard has player
// widgets and this player is selectable, it's a button that makes them the
// dashboard's subject; otherwise it's plain text.
const props = defineProps<{ playerId: string; name: string }>();

const { t } = useI18n();
const selection = usePlayerSelection();

const selectable = computed(() => selection.canSelect(props.playerId));
const selected = computed(() => selection.selectedId.value === props.playerId);
</script>

<template>
  <button
    v-if="selectable"
    type="button"
    class="self-start text-left font-semibold underline decoration-border decoration-dotted underline-offset-4 hover:text-accent hover:decoration-accent"
    :class="selected ? 'text-accent' : 'text-text'"
    :aria-pressed="selected"
    :title="t('widgets.viewPlayer', { name })"
    @click="selection.select(playerId)"
  >
    {{ name }}
  </button>
  <span v-else class="font-semibold text-text">{{ name }}</span>
</template>
