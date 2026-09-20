<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { extractErrorMessage } from "../../lib/errors";
import { searchPlayers, type PlayerSearchResult } from "../../services/players";
import { useTournamentsStore } from "../../stores/tournaments";

const props = defineProps<{ tournamentId: string }>();

const tournaments = useTournamentsStore();
const { t } = useI18n();

// --- HU07: enroll player ---

const playerQuery = ref("");
const searchResults = ref<PlayerSearchResult[]>([]);
const searching = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);

const registrationOpen = computed(() => tournaments.current?.status === "REGISTRATION_OPEN");
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
async function onEnroll(player: PlayerSearchResult): Promise<void> {
  error.value = null;
  submitting.value = true;
  try {
    await tournaments.enrollPlayer(props.tournamentId, player.id);
    playerQuery.value = "";
    searchResults.value = [];
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("tournamentAdmin.genericServerError"));
  } finally {
    submitting.value = false;
  }
}

// --- HU27: withdraw player ---

const withdrawing = ref<string | null>(null);

/** Withdraws an enrolled player from the tournament, after confirmation. */
async function onWithdraw(player: { playerId: string; name: string }): Promise<void> {
  if (!window.confirm(t("tournamentAdmin.withdrawConfirm", { name: player.name }))) {
    return;
  }

  error.value = null;
  withdrawing.value = player.playerId;
  try {
    await tournaments.withdrawPlayer(props.tournamentId, player.playerId);
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("tournamentAdmin.genericServerError"));
  } finally {
    withdrawing.value = null;
  }
}
</script>

<template>
  <section class="card">
    <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.playersTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("tournamentAdmin.playersSubtitle") }}</p>

    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 -translate-y-1.5"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0 -translate-y-1.5"
    >
      <p v-if="error" role="alert" class="banner banner--error mb-4">{{ error }}</p>
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
              :disabled="submitting || enrolledIds.has(player.id)"
              @click="onEnroll(player)"
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
            <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
              {{ t("tournamentAdmin.tableName") }}
            </th>
            <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
              {{ t("tournamentAdmin.tableCode") }}
            </th>
            <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
              {{ t("tournamentAdmin.tableProgram") }}
            </th>
            <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
              {{ t("tournamentAdmin.tableSemester") }}
            </th>
            <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in tournaments.enrolledPlayers" :key="player.playerId">
            <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.name }}</td>
            <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.universityCode }}</td>
            <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.program }}</td>
            <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ player.semester }}</td>
            <td class="border-b border-border-soft px-2.5 py-2 text-sm">
              <button
                type="button"
                class="btn btn-ghost"
                :disabled="withdrawing === player.playerId"
                @click="onWithdraw(player)"
              >
                {{ t("tournamentAdmin.withdraw") }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-text-muted">{{ t("tournamentAdmin.noPlayers") }}</p>
  </section>
</template>
