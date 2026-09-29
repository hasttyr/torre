<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { TIEBREAKS, type Tiebreak } from "../../services/tournaments";

// RN-05/HU13: the tournament's tiebreak criteria, in order, chosen from the
// closed catalog (a free-text name used to be skipped without a word when a
// typo made it unknown). Plain buttons move, remove and add, so the order can
// be set with a keyboard as easily as with a pointer.
const order = defineModel<Tiebreak[]>({ required: true });
defineProps<{ disabled?: boolean }>();

const { t } = useI18n();

const available = computed(() => TIEBREAKS.filter((tiebreak) => !order.value.includes(tiebreak)));
const toAdd = ref<Tiebreak | "">("");
const label = (tiebreak: Tiebreak) => t(`tiebreaks.${tiebreak}`);

function move(tiebreak: Tiebreak, offset: -1 | 1): void {
  const next = order.value.filter((chosen) => chosen !== tiebreak);
  next.splice(order.value.indexOf(tiebreak) + offset, 0, tiebreak);
  order.value = next;
}

function remove(tiebreak: Tiebreak): void {
  order.value = order.value.filter((chosen) => chosen !== tiebreak);
}

function add(): void {
  if (!toAdd.value) return;
  order.value = [...order.value, toAdd.value];
  toAdd.value = "";
}
</script>

<template>
  <fieldset id="tiebreaks" class="m-0 flex flex-col gap-2 border-0 p-0" :disabled="disabled">
    <legend class="field-label mb-1">{{ t("tournamentAdmin.tiebreaksLabel") }}</legend>
    <p class="m-0 text-sm text-text-muted">{{ t("tournamentAdmin.tiebreaksHint") }}</p>

    <ol v-if="order.length > 0" class="m-0 flex list-none flex-col gap-1.5 p-0">
      <li
        v-for="(tiebreak, index) in order"
        :key="tiebreak"
        class="flex items-center gap-2 rounded-lg border border-border-soft px-3 py-2"
      >
        <span class="flex-1 text-sm font-medium">{{ label(tiebreak) }}</span>
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('tournamentAdmin.tiebreakMoveUp', { name: label(tiebreak) })"
          :disabled="index === 0"
          @click="move(tiebreak, -1)"
        >
          ↑
        </button>
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('tournamentAdmin.tiebreakMoveDown', { name: label(tiebreak) })"
          :disabled="index === order.length - 1"
          @click="move(tiebreak, 1)"
        >
          ↓
        </button>
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('tournamentAdmin.tiebreakRemove', { name: label(tiebreak) })"
          @click="remove(tiebreak)"
        >
          ✕
        </button>
      </li>
    </ol>
    <p v-else class="m-0 text-sm text-text-muted">{{ t("tournamentAdmin.tiebreaksEmpty") }}</p>

    <div v-if="available.length > 0" class="flex items-end gap-2">
      <div class="field flex-1">
        <label for="tiebreakToAdd">{{ t("tournamentAdmin.tiebreakAddLabel") }}</label>
        <select id="tiebreakToAdd" v-model="toAdd" name="tiebreakToAdd" autocomplete="off">
          <option value="" disabled>{{ t("tournamentAdmin.tiebreakChoose") }}</option>
          <option v-for="tiebreak in available" :key="tiebreak" :value="tiebreak">{{ label(tiebreak) }}</option>
        </select>
      </div>
      <button type="button" class="btn btn-ghost" :disabled="!toAdd" @click="add">
        {{ t("tournamentAdmin.tiebreakAdd") }}
      </button>
    </div>
  </fieldset>
</template>
