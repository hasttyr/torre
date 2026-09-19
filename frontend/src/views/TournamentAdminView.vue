<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import { searchPlayers, type PlayerSearchResult } from "../services/players";
import { useTournamentsStore } from "../stores/tournaments";

const route = useRoute();
const tournaments = useTournamentsStore();
const tournamentId = String(route.params.id);
const { t } = useI18n();

const loadError = ref<string | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    await tournaments.load(tournamentId);
    populateConfigForm();
  } catch {
    loadError.value = t("tournamentAdmin.loadError");
  } finally {
    loading.value = false;
  }
});

// --- HU05: configure tournament (rounds, time control, tiebreaks) ---

const configForm = reactive({
  roundsCount: "",
  timeControl: "",
  tiebreaks: "Buchholz, Buchholz Cortado 1, Sonneborn-Berger, ARO",
  restrictedProgram: "",
  minimumSemester: "",
});
const configSubmitting = ref(false);
const configError = ref<string | null>(null);
const configSuccess = ref<string | null>(null);

/**
 * Fills the configuration form from the loaded tournament instead of
 * always starting blank: if the organizer comes back to an already
 * configured tournament, they see what's there.
 */
function populateConfigForm(): void {
  if (!tournaments.current) return;
  configForm.roundsCount = tournaments.current.roundsCount != null ? String(tournaments.current.roundsCount) : "";
  configForm.timeControl = tournaments.current.timeControl ?? "";
  if (tournaments.current.tiebreakCriteria.length > 0) {
    configForm.tiebreaks = tournaments.current.tiebreakCriteria.map((c) => c.name).join(", ");
  }
  configForm.restrictedProgram = tournaments.current.restrictedProgram ?? "";
  configForm.minimumSemester = tournaments.current.minimumSemester != null ? String(tournaments.current.minimumSemester) : "";
}

// RN-05: the tiebreak order can only be changed while the tournament is in
// its preliminary state (before round 1). The backend is what actually
// decides; this only avoids a submit that is already known to fail.
const canEditTiebreaks = computed(() => tournaments.current?.status === "CREADO");

/** Validates and submits the tournament configuration form. */
async function onConfigure(): Promise<void> {
  configError.value = null;
  configSuccess.value = null;
  configSubmitting.value = true;
  try {
    const tiebreakCriteria = configForm.tiebreaks
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name, index) => ({ name, order: index + 1 }));

    await tournaments.configure(tournamentId, {
      roundsCount: configForm.roundsCount ? Number(configForm.roundsCount) : undefined,
      timeControl: configForm.timeControl.trim() || undefined,
      tiebreakCriteria: canEditTiebreaks.value ? tiebreakCriteria : undefined,
      restrictedProgram: configForm.restrictedProgram.trim() || null,
      minimumSemester: configForm.minimumSemester ? Number(configForm.minimumSemester) : null,
    });
    configSuccess.value = t("tournamentAdmin.configSuccess");
  } catch (error) {
    configError.value = extractError(error);
  } finally {
    configSubmitting.value = false;
  }
}

// --- HU06: open / close registration ---

const registrationSubmitting = ref(false);
const registrationError = ref<string | null>(null);

/** Opens registration for the current tournament. */
async function onOpenRegistration(): Promise<void> {
  registrationError.value = null;
  registrationSubmitting.value = true;
  try {
    await tournaments.openRegistration(tournamentId);
  } catch (error) {
    registrationError.value = extractError(error);
  } finally {
    registrationSubmitting.value = false;
  }
}

/** Closes registration for the current tournament. */
async function onCloseRegistration(): Promise<void> {
  registrationError.value = null;
  registrationSubmitting.value = true;
  try {
    await tournaments.closeRegistration(tournamentId);
  } catch (error) {
    registrationError.value = extractError(error);
  } finally {
    registrationSubmitting.value = false;
  }
}

// --- HU07: enroll player ---

const playerQuery = ref("");
const searchResults = ref<PlayerSearchResult[]>([]);
const searching = ref(false);
const enrollSubmitting = ref(false);
const enrollError = ref<string | null>(null);

const registrationOpen = computed(() => tournaments.current?.status === "INSCRIPCIONES_ABIERTAS");
const enrolledIds = computed(() => new Set(tournaments.enrolledPlayers.map((p) => p.playerId)));

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

// Debounced search: avoids one request per keystroke while the organizer
// types a name, email or university code.
watch(playerQuery, (query) => {
  clearTimeout(debounceHandle);
  if (!query.trim()) {
    searchResults.value = [];
    return;
  }
  debounceHandle = setTimeout(async () => {
    searching.value = true;
    try {
      searchResults.value = await searchPlayers(query.trim());
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  }, 300);
});

/** Enrolls a chosen player from the search results into the tournament. */
async function onEnrollPlayer(player: PlayerSearchResult): Promise<void> {
  enrollError.value = null;
  enrollSubmitting.value = true;
  try {
    await tournaments.enrollPlayer(tournamentId, player.id);
    playerQuery.value = "";
    searchResults.value = [];
  } catch (error) {
    enrollError.value = extractError(error);
  } finally {
    enrollSubmitting.value = false;
  }
}

/** Extracts a user-facing error message from a failed API call. */
function extractError(error: unknown): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
    return error.response.data.error;
  }
  return t("tournamentAdmin.genericServerError");
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-6 py-10 sm:py-12">
      <p v-if="loading">{{ t("tournamentAdmin.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <template v-else-if="tournaments.current">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-2xl sm:text-3xl">{{ tournaments.current.name }}</h1>
          <span class="pill">{{ t(`estados.${tournaments.current.status}`) }}</span>
        </header>

        <!-- HU05 -->
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.configTitle") }}</h2>
          <p class="mb-4 text-sm">{{ t("tournamentAdmin.configSubtitle") }}</p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="configError" role="alert" class="banner banner--error mb-4">{{ configError }}</p>
          </Transition>
          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="configSuccess" class="banner banner--success mb-4">{{ configSuccess }}</p>
          </Transition>

          <form novalidate class="config-form flex flex-col gap-4" @submit.prevent="onConfigure">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field">
                <label for="roundsCount">{{ t("tournamentAdmin.roundsCountLabel") }}</label>
                <input id="roundsCount" v-model="configForm.roundsCount" type="number" min="1" placeholder="7" />
              </div>
              <div class="field">
                <label for="timeControl">{{ t("tournamentAdmin.timeControlLabel") }}</label>
                <input id="timeControl" v-model="configForm.timeControl" type="text" placeholder="90+30" />
              </div>
            </div>

            <div class="field">
              <label for="tiebreaks">{{ t("tournamentAdmin.tiebreaksLabel") }}</label>
              <input
                id="tiebreaks"
                v-model="configForm.tiebreaks"
                type="text"
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
                    :placeholder="t('tournamentAdmin.restrictedProgramPlaceholder')"
                  />
                </div>
                <div class="field">
                  <label for="minimumSemester">{{ t("tournamentAdmin.minimumSemesterLabel") }}</label>
                  <input
                    id="minimumSemester"
                    v-model="configForm.minimumSemester"
                    type="number"
                    min="1"
                    :placeholder="t('tournamentAdmin.minimumSemesterPlaceholder')"
                  />
                </div>
              </div>
              <p class="mt-2 text-sm text-text-muted">
                {{ t("tournamentAdmin.eligibilityHint") }}
              </p>
            </div>

            <button type="submit" class="btn btn-primary self-start" :disabled="configSubmitting">
              {{ configSubmitting ? t("tournamentAdmin.saving") : t("tournamentAdmin.saveConfig") }}
            </button>
          </form>
        </section>

        <!-- HU06 -->
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.registrationTitle") }}</h2>
          <p class="mb-4 text-sm">
            {{ t("tournamentAdmin.registrationSubtitle") }}
            <strong class="text-text">{{ t(`estados.${tournaments.current.status}`) }}</strong>
          </p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="registrationError" role="alert" class="banner banner--error mb-4">{{ registrationError }}</p>
          </Transition>

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="registrationSubmitting || tournaments.current.status !== 'CREADO'"
              @click="onOpenRegistration"
            >
              {{ t("tournamentAdmin.openRegistration") }}
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="registrationSubmitting || tournaments.current.status !== 'INSCRIPCIONES_ABIERTAS'"
              @click="onCloseRegistration"
            >
              {{ t("tournamentAdmin.closeRegistration") }}
            </button>
          </div>
        </section>

        <!-- HU07 -->
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.playersTitle") }}</h2>
          <p class="mb-4 text-sm">{{ t("tournamentAdmin.playersSubtitle") }}</p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="enrollError" role="alert" class="banner banner--error mb-4">{{ enrollError }}</p>
          </Transition>

          <div class="field relative">
            <label for="playerQuery">{{ t("tournamentAdmin.searchLabel") }}</label>
            <input
              id="playerQuery"
              v-model="playerQuery"
              type="text"
              :placeholder="t('tournamentAdmin.searchPlaceholder')"
              :disabled="!registrationOpen"
            />

            <ul
              v-if="playerQuery.trim() && registrationOpen"
              class="mt-2 list-none overflow-hidden rounded-lg border border-border-soft p-0"
            >
              <li v-if="searching" class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("tournamentAdmin.searching") }}</li>
              <template v-else-if="searchResults.length > 0">
                <li
                  v-for="player in searchResults"
                  :key="player.id"
                  class="flex items-center justify-between gap-3 border-b border-border-soft px-3.5 py-2.5 last:border-b-0"
                >
                  <div class="flex flex-col gap-0.5">
                    <strong class="text-text">{{ player.name }}</strong>
                    <span class="text-sm text-text-muted">{{ player.universityCode }} · {{ player.program }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="enrollSubmitting || enrolledIds.has(player.id)"
                    @click="onEnrollPlayer(player)"
                  >
                    {{ enrolledIds.has(player.id) ? t("tournamentAdmin.alreadyEnrolled") : t("tournamentAdmin.enroll") }}
                  </button>
                </li>
              </template>
              <li v-else class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("tournamentAdmin.noResults") }}</li>
            </ul>
          </div>
          <p v-if="!registrationOpen" class="mb-4 text-sm text-text-muted">
            {{ t("tournamentAdmin.registrationClosedHint") }}
          </p>

          <div v-if="tournaments.enrolledPlayers.length > 0" class="mt-4 -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <table class="w-full min-w-md border-collapse">
              <thead>
                <tr>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableName") }}</th>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableCode") }}</th>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableProgram") }}</th>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableSemester") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="player in tournaments.enrolledPlayers" :key="player.playerId">
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.name }}</td>
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.universityCode }}</td>
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.program }}</td>
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.semester }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-text-muted">{{ t("tournamentAdmin.noPlayers") }}</p>
        </section>
      </template>
    </main>
  </div>
</template>
