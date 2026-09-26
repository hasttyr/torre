<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { extractErrorMessage } from "../../lib/errors";
import { useTournamentsStore } from "../../stores/tournaments";

const props = defineProps<{ tournamentId: string }>();

const tournaments = useTournamentsStore();
const { t } = useI18n();

// --- HU05: configure tournament (rounds, time control, tiebreaks) ---

const configForm = reactive({
  roundsCount: "",
  timeControl: "",
  // HU13's order. ARO can't be computed (no ratings in scope) and is skipped when ranking.
  tiebreaks: "Buchholz, Buchholz Cortado 1, Sonneborn-Berger, ARO, Resultado particular",
  byePoints: "1",
  restrictedProgram: "",
  minimumSemester: "",
});
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

/**
 * Fills the configuration form from the loaded tournament instead of
 * always starting blank: if the organizer comes back to an already
 * configured tournament, they see what's there.
 */
function populateForm(): void {
  const tournament = tournaments.current;
  if (!tournament) return;
  configForm.roundsCount = tournament.roundsCount != null ? String(tournament.roundsCount) : "";
  configForm.timeControl = tournament.timeControl ?? "";
  if (tournament.tiebreakCriteria.length > 0) {
    configForm.tiebreaks = tournament.tiebreakCriteria.map((c) => c.name).join(", ");
  }
  configForm.byePoints = String(tournament.byePoints ?? 1);
  configForm.restrictedProgram = tournament.restrictedProgram ?? "";
  configForm.minimumSemester = tournament.minimumSemester != null ? String(tournament.minimumSemester) : "";
}

watch(() => tournaments.current, populateForm, { immediate: true });

// RN-05: the tiebreak order can only be changed while the tournament is in
// its preliminary state (before round 1). The backend is what actually
// decides; this only avoids a submit that is already known to fail.
const canEditTiebreaks = computed(() => tournaments.current?.status === "CREATED");

/** Validates and submits the tournament configuration form. */
async function onSubmit(): Promise<void> {
  error.value = null;
  success.value = null;
  submitting.value = true;
  try {
    const tiebreakCriteria = configForm.tiebreaks
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name, index) => ({ name, order: index + 1 }));

    await tournaments.configure(props.tournamentId, {
      roundsCount: configForm.roundsCount ? Number(configForm.roundsCount) : undefined,
      timeControl: configForm.timeControl.trim() || undefined,
      tiebreakCriteria: canEditTiebreaks.value ? tiebreakCriteria : undefined,
      // Same lock as the tiebreaks: fixed once round 1 exists (HU28).
      byePoints: canEditTiebreaks.value ? (Number(configForm.byePoints) as 0 | 0.5 | 1) : undefined,
      restrictedProgram: configForm.restrictedProgram.trim() || null,
      minimumSemester: configForm.minimumSemester ? Number(configForm.minimumSemester) : null,
    });
    success.value = t("tournamentAdmin.configSuccess");
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("tournamentAdmin.genericServerError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.configTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("tournamentAdmin.configSubtitle") }}</p>

    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 -translate-y-1.5"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0 -translate-y-1.5"
    >
      <p v-if="error" role="alert" class="banner banner--error mb-4">{{ error }}</p>
    </Transition>
    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 -translate-y-1.5"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0 -translate-y-1.5"
    >
      <p v-if="success" class="banner banner--success mb-4">{{ success }}</p>
    </Transition>

    <form novalidate class="config-form flex flex-col gap-4" @submit.prevent="onSubmit">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="field">
          <label for="roundsCount">{{ t("tournamentAdmin.roundsCountLabel") }}</label>
          <input
            id="roundsCount"
            v-model="configForm.roundsCount"
            type="number"
            name="roundsCount"
            autocomplete="off"
            min="1"
            placeholder="7"
          />
        </div>
        <div class="field">
          <label for="timeControl">{{ t("tournamentAdmin.timeControlLabel") }}</label>
          <input
            id="timeControl"
            v-model="configForm.timeControl"
            type="text"
            name="timeControl"
            autocomplete="off"
            spellcheck="false"
            placeholder="90+30"
          />
        </div>
      </div>

      <div class="field">
        <label for="byePoints">{{ t("tournamentAdmin.byePointsLabel") }}</label>
        <select id="byePoints" v-model="configForm.byePoints" name="byePoints" :disabled="!canEditTiebreaks">
          <option value="1">{{ t("tournamentAdmin.byePointsOptions.1") }}</option>
          <option value="0.5">{{ t("tournamentAdmin.byePointsOptions.0_5") }}</option>
          <option value="0">{{ t("tournamentAdmin.byePointsOptions.0") }}</option>
        </select>
      </div>

      <div class="field">
        <label for="tiebreaks">{{ t("tournamentAdmin.tiebreaksLabel") }}</label>
        <input
          id="tiebreaks"
          v-model="configForm.tiebreaks"
          type="text"
          name="tiebreaks"
          autocomplete="off"
          :disabled="!canEditTiebreaks"
        />
        <span v-if="!canEditTiebreaks" class="text-sm text-text-muted">
          {{ t("tournamentAdmin.tiebreaksLockedHint") }}
        </span>
      </div>

      <div class="border-t border-border-soft pt-4">
        <p class="field-label mb-3">{{ t("tournamentAdmin.eligibilityLegend") }}</p>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="field">
            <label for="restrictedProgram">{{ t("tournamentAdmin.restrictedProgramLabel") }}</label>
            <input
              id="restrictedProgram"
              v-model="configForm.restrictedProgram"
              type="text"
              name="restrictedProgram"
              autocomplete="off"
              :placeholder="t('tournamentAdmin.restrictedProgramPlaceholder')"
            />
          </div>
          <div class="field">
            <label for="minimumSemester">{{ t("tournamentAdmin.minimumSemesterLabel") }}</label>
            <input
              id="minimumSemester"
              v-model="configForm.minimumSemester"
              type="number"
              name="minimumSemester"
              autocomplete="off"
              min="1"
              :placeholder="t('tournamentAdmin.minimumSemesterPlaceholder')"
            />
          </div>
        </div>
        <p class="mt-2 text-sm text-text-muted">
          {{ t("tournamentAdmin.eligibilityHint") }}
        </p>
      </div>

      <button type="submit" class="btn btn-primary self-start" :disabled="submitting">
        {{ submitting ? t("tournamentAdmin.saving") : t("tournamentAdmin.saveConfig") }}
      </button>
    </form>
  </section>
</template>
