<script setup lang="ts">
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";

import type { Round, SwapPayload } from "../../services/rounds";

// HU29: swaps two players' seats in a draft round (same board = colors
// flipped). The reason is mandatory (RN-09) and goes to the audit log.
const props = defineProps<{ round: Round; busy: boolean }>();
const emit = defineEmits<{ swap: [payload: SwapPayload] }>();

const { t } = useI18n();
const form = reactive({ playerAId: "", playerBId: "", reason: "" });

const players = computed(() =>
  props.round.matches
    .flatMap((match) => [match.white, match.black])
    .filter((seat) => seat !== null)
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const valid = computed(
  () => form.playerAId && form.playerBId && form.playerAId !== form.playerBId && form.reason.trim().length >= 3,
);

function onSubmit(): void {
  if (!valid.value) return;
  emit("swap", { playerAId: form.playerAId, playerBId: form.playerBId, reason: form.reason.trim() });
  Object.assign(form, { playerAId: "", playerBId: "", reason: "" });
}
</script>

<template>
  <form
    class="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-4"
    novalidate
    @submit.prevent="onSubmit"
  >
    <div>
      <h3 class="text-base">{{ t("roundManager.swapTitle") }}</h3>
      <p class="text-xs">{{ t("roundManager.swapHint") }}</p>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="field">
        <label for="swapPlayerA">{{ t("roundManager.swapPlayerA") }}</label>
        <select id="swapPlayerA" v-model="form.playerAId">
          <option value="" disabled>{{ t("roundManager.choosePlayer") }}</option>
          <option v-for="player in players" :key="player.playerId" :value="player.playerId">{{ player.name }}</option>
        </select>
      </div>
      <div class="field">
        <label for="swapPlayerB">{{ t("roundManager.swapPlayerB") }}</label>
        <select id="swapPlayerB" v-model="form.playerBId">
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
      </div>
    </div>
    <div class="field">
      <label for="swapReason">{{ t("roundManager.swapReason") }}</label>
      <input id="swapReason" v-model="form.reason" type="text" :placeholder="t('roundManager.swapReasonPlaceholder')" />
    </div>
    <button type="submit" class="btn btn-ghost self-start" :disabled="busy || !valid">
      {{ t("roundManager.swapSubmit") }}
    </button>
  </form>
</template>
