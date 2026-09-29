<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { extractErrorMessage } from "../../lib/errors";
import { hasChanges, useUnsavedChangesGuard } from "../../lib/unsavedChanges";
import { showTournament, tournamentQuery } from "../../queries/tournaments";
import { configureTournament, DEFAULT_TIEBREAKS, type Tiebreak, type Tournament } from "../../services/tournaments";
import TiebreakOrderPicker from "./TiebreakOrderPicker.vue";
import FadeSlide from "../ui/FadeSlide.vue";
import FormBanner from "../ui/FormBanner.vue";

const props = defineProps<{ tournamentId: string }>();

const cache = useQueryCache();
const tournamentEntry = useQuery(() => tournamentQuery(props.tournamentId));
const current = computed(() => tournamentEntry.data.value ?? null);
const { t } = useI18n();

// --- HU05: configure tournament (rounds, time control, tiebreaks) ---

/**
 * The tournament's saved configuration, in the form's shape: an organizer
 * coming back to a configured tournament sees what's there, and one that
 * has no tiebreaks yet gets HU13's suggested order.
 */
function configFormOf(tournament: Tournament) {
  return {
    roundsCount: tournament.roundsCount != null ? String(tournament.roundsCount) : "",
    timeControl: tournament.timeControl ?? "",
    tiebreaks:
      tournament.tiebreakCriteria.length > 0 ? tournament.tiebreakCriteria.map((c) => c.name) : [...DEFAULT_TIEBREAKS],
    byePoints: String(tournament.byePoints ?? 1),
    restrictedProgram: tournament.restrictedProgram ?? "",
    minimumSemester: tournament.minimumSemester != null ? String(tournament.minimumSemester) : "",
  };
}

const configForm = reactive({
  roundsCount: "",
  timeControl: "",
  tiebreaks: [...DEFAULT_TIEBREAKS] as Tiebreak[],
  byePoints: "1",
  restrictedProgram: "",
  minimumSemester: "",
});
const submitting = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);

// The tournament the form was last filled from.
let filledFrom: Tournament | null = null;

/** Fills the configuration form from `tournament`. */
function fillForm(tournament: Tournament): void {
  filledFrom = tournament;
  Object.assign(configForm, configFormOf(tournament));
}

// The tournament is read again in the background (returning to the tab, a
// real-time event): an untouched form follows it, but what the organizer is
// typing is never overwritten.
watch(
  current,
  (tournament) => {
    if (tournament && (!filledFrom || !hasChanges(configForm, configFormOf(filledFrom)))) fillForm(tournament);
  },
  { immediate: true },
);

useUnsavedChangesGuard(() => current.value !== null && hasChanges(configForm, configFormOf(current.value)));

// RN-05: the tiebreak order can only be changed while the tournament is in
// its preliminary state (before round 1). The backend is what actually
// decides; this only avoids a submit that is already known to fail.
const canEditTiebreaks = computed(() => current.value?.status === "CREATED");

/** Validates and submits the tournament configuration form. */
async function onSubmit(): Promise<void> {
  error.value = null;
  success.value = null;
  submitting.value = true;
  try {
    const tiebreakCriteria = configForm.tiebreaks.map((name, index) => ({ name, order: index + 1 }));

    const saved = await configureTournament(props.tournamentId, {
      roundsCount: configForm.roundsCount ? Number(configForm.roundsCount) : undefined,
      timeControl: configForm.timeControl.trim() || undefined,
      tiebreakCriteria: canEditTiebreaks.value ? tiebreakCriteria : undefined,
      // Same lock as the tiebreaks: fixed once round 1 exists (HU28).
      byePoints: canEditTiebreaks.value ? (Number(configForm.byePoints) as 0 | 0.5 | 1) : undefined,
      restrictedProgram: configForm.restrictedProgram.trim() || null,
      minimumSemester: configForm.minimumSemester ? Number(configForm.minimumSemester) : null,
    });
    showTournament(cache, saved);
    fillForm(saved);
    success.value = t("tournamentAdmin.configSuccess");
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("common.genericServerError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.configTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("tournamentAdmin.configSubtitle") }}</p>

    <FadeSlide>
      <FormBanner v-if="error" kind="error" class="mb-4">{{ error }}</FormBanner>
    </FadeSlide>
    <FadeSlide>
      <FormBanner v-if="success" kind="success" class="mb-4">{{ success }}</FormBanner>
    </FadeSlide>

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

      <div>
        <TiebreakOrderPicker v-model="configForm.tiebreaks" :disabled="!canEditTiebreaks" />
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
