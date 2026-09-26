<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

import type { GameResult, Match } from "../../services/rounds";
import ResultPicker from "./ResultPicker.vue";

// One board's result control for whoever may record results (RN-06):
// a game without a result gets the picker directly (HU10); a recorded one
// needs an explicit "Correct" step with an optional reason (HU11), so a
// misclick can't silently overwrite an official result.
const props = defineProps<{ match: Match; busy: boolean }>();
const emit = defineEmits<{
  record: [value: GameResult];
  correct: [value: GameResult, reason: string];
}>();

const { t } = useI18n();
const reasonId = useId();
const correcting = ref(false);
const pickedCorrection = ref<GameResult | null>(null);
const reason = ref("");

// Each step replaces the control that was just pressed; focus follows to
// what replaced it instead of falling back to the top of the page.
const correctButton = useTemplateRef<HTMLButtonElement>("correctButton");
const correctionPanel = useTemplateRef<HTMLElement>("correctionPanel");
let recordedHere = false;

function startCorrection(): void {
  correcting.value = true;
  pickedCorrection.value = null;
  reason.value = "";
  void nextTick(() => correctionPanel.value?.querySelector<HTMLElement>("[aria-pressed='true']")?.focus());
}

function closeCorrection(): void {
  correcting.value = false;
  void nextTick(() => correctButton.value?.focus());
}

function confirmCorrection(): void {
  if (!pickedCorrection.value) return;
  emit("correct", pickedCorrection.value, reason.value.trim());
  closeCorrection();
}

function record(value: GameResult): void {
  recordedHere = true;
  emit("record", value);
}

// A result this control recorded lands once saved: focus moves to its
// Correct button, unless the user has moved on meanwhile. A result
// recorded elsewhere (a live update) never takes focus.
watch(
  () => props.match.result,
  (result) => {
    if (!result || !recordedHere) return;
    recordedHere = false;
    // After the render: the pressed button is gone, so focus fell to <body>
    // unless the user already moved it elsewhere.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    correctButton.value?.focus();
  },
  { flush: "post" },
);
</script>

<template>
  <ResultPicker v-if="!props.match.result" :disabled="busy" @pick="record" />

  <button
    v-else-if="!correcting"
    ref="correctButton"
    type="button"
    class="text-sm font-semibold text-accent hover:underline"
    @click="startCorrection"
  >
    {{ t("rounds.correct") }}
  </button>

  <div
    v-else
    ref="correctionPanel"
    class="flex flex-col gap-2 rounded-xl border border-border-soft bg-surface-2/50 p-3"
    @keydown.esc="closeCorrection"
  >
    <ResultPicker
      :current="pickedCorrection ?? props.match.result"
      :disabled="busy"
      @pick="pickedCorrection = $event"
    />
    <div class="field">
      <label :for="reasonId" class="text-xs">{{ t("rounds.correctionReason") }}</label>
      <input
        :id="reasonId"
        v-model="reason"
        type="text"
        name="correctionReason"
        autocomplete="off"
        class="!py-2 text-sm"
        :placeholder="t('rounds.correctionPlaceholder')"
      />
    </div>
    <div class="flex gap-2">
      <button
        type="button"
        class="btn btn-primary px-3.5 py-2 text-sm"
        :disabled="busy || !pickedCorrection || pickedCorrection === props.match.result"
        @click="confirmCorrection"
      >
        {{ t("rounds.saveCorrection") }}
      </button>
      <button type="button" class="btn btn-ghost px-3.5 py-2 text-sm" @click="closeCorrection">
        {{ t("common.cancel") }}
      </button>
    </div>
  </div>
</template>
