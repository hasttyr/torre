<script setup lang="ts">
import { computed, reactive, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

import { errorAttrs, errorId, focusFirstInvalid } from "../../lib/formErrors";
import type { Round, SwapPayload } from "../../services/rounds";

// HU29: swaps two players' seats in a draft round (same board = colors
// flipped). The reason is mandatory (RN-09) and goes to the audit log.
const props = defineProps<{ round: Round; busy: boolean }>();
const emit = defineEmits<{ swap: [payload: SwapPayload] }>();

const { t } = useI18n();
const form = reactive({ playerAId: "", playerBId: "", reason: "" });
// Keyed by field id, so each error lands next to its own control.
const errors = reactive<Record<string, string>>({});
const formEl = useTemplateRef<HTMLFormElement>("formEl");

const players = computed(() =>
  props.round.matches
    .flatMap((match) => [match.white, match.black])
    .filter((seat) => seat !== null)
    .sort((a, b) => a.name.localeCompare(b.name)),
);

/** Checks both players and the reason, leaving a message next to each field that needs one. */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (!form.playerAId) {
    errors.swapPlayerA = t("roundManager.choosePlayer");
  }
  if (!form.playerBId) {
    errors.swapPlayerB = t("roundManager.choosePlayer");
  } else if (form.playerBId === form.playerAId) {
    errors.swapPlayerB = t("roundManager.swapSamePlayer");
  }
  if (form.reason.trim().length < 3) {
    errors.swapReason = t("roundManager.swapReasonRequired");
  }

  return Object.keys(errors).length === 0;
}

async function onSubmit(): Promise<void> {
  if (!validate()) {
    await focusFirstInvalid(formEl.value);
    return;
  }
  emit("swap", { playerAId: form.playerAId, playerBId: form.playerBId, reason: form.reason.trim() });
  Object.assign(form, { playerAId: "", playerBId: "", reason: "" });
}
</script>

<template>
  <form
    ref="formEl"
    class="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4"
    novalidate
    @submit.prevent="onSubmit"
  >
    <div>
      <h3 class="text-base">{{ t("roundManager.swapTitle") }}</h3>
      <p class="text-xs">{{ t("roundManager.swapHint") }}</p>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="field" :class="{ 'has-error': errors.swapPlayerA }">
        <label for="swapPlayerA">{{ t("roundManager.swapPlayerA") }}</label>
        <select id="swapPlayerA" v-model="form.playerAId" name="swapPlayerA" v-bind="errorAttrs(errors, 'swapPlayerA')">
          <option value="" disabled>{{ t("roundManager.choosePlayer") }}</option>
          <option v-for="player in players" :key="player.playerId" :value="player.playerId">{{ player.name }}</option>
        </select>
        <span :id="errorId('swapPlayerA')" class="field-error">{{ errors.swapPlayerA }}</span>
      </div>
      <div class="field" :class="{ 'has-error': errors.swapPlayerB }">
        <label for="swapPlayerB">{{ t("roundManager.swapPlayerB") }}</label>
        <select id="swapPlayerB" v-model="form.playerBId" name="swapPlayerB" v-bind="errorAttrs(errors, 'swapPlayerB')">
          <option value="" disabled>{{ t("roundManager.choosePlayer") }}</option>
          <option
            v-for="player in players"
            :key="player.playerId"
            :value="player.playerId"
            :disabled="player.playerId === form.playerAId"
          >
            {{ player.name }}
          </option>
        </select>
        <span :id="errorId('swapPlayerB')" class="field-error">{{ errors.swapPlayerB }}</span>
      </div>
    </div>
    <div class="field" :class="{ 'has-error': errors.swapReason }">
      <label for="swapReason">{{ t("roundManager.swapReason") }}</label>
      <input
        id="swapReason"
        v-model="form.reason"
        type="text"
        name="swapReason"
        autocomplete="off"
        :placeholder="t('roundManager.swapReasonPlaceholder')"
        v-bind="errorAttrs(errors, 'swapReason')"
      />
      <span :id="errorId('swapReason')" class="field-error">{{ errors.swapReason }}</span>
    </div>
    <button type="submit" class="btn btn-ghost self-start" :disabled="busy">
      {{ t("roundManager.swapSubmit") }}
    </button>
  </form>
</template>
