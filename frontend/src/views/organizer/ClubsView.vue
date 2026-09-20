<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import { extractErrorMessage } from "../../lib/errors";
import { searchPlayers, type PlayerSearchResult } from "../../services/players";
import { useClubsStore } from "../../stores/clubs";

const clubs = useClubsStore();
const { t } = useI18n();

const loading = ref(true);
const loadError = ref<string | null>(null);
const selectedClubId = ref<string | null>(null);

onMounted(async () => {
  try {
    await clubs.loadClubs();
  } catch {
    loadError.value = t("clubs.loadError");
  } finally {
    loading.value = false;
  }
});

const selectedClub = computed(() => clubs.clubs.find((club) => club.id === selectedClubId.value) ?? null);

/** Selects a club and loads its roster. */
async function selectClub(clubId: string): Promise<void> {
  selectedClubId.value = clubId;
  rosterError.value = null;
  try {
    await clubs.loadPlayers(clubId);
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("clubs.genericServerError"));
  }
}

// --- create club ---

const newClubName = ref("");
const createSubmitting = ref(false);
const createError = ref<string | null>(null);

/** Validates and submits the "new club" form. */
async function onCreateClub(): Promise<void> {
  createError.value = null;
  if (newClubName.value.trim().length < 2) {
    createError.value = t("clubs.nameMinLength");
    return;
  }

  createSubmitting.value = true;
  try {
    const club = await clubs.createClub(newClubName.value.trim());
    newClubName.value = "";
    await selectClub(club.id);
  } catch (error) {
    createError.value = extractErrorMessage(error, t("clubs.genericServerError"));
  } finally {
    createSubmitting.value = false;
  }
}

// --- rename club ---

const renaming = ref(false);
const renameName = ref("");
const renameError = ref<string | null>(null);
const renameSubmitting = ref(false);

watch(selectedClub, (club) => {
  renaming.value = false;
  renameName.value = club?.name ?? "";
  renameError.value = null;
});

/** Submits the club rename form. */
async function onRename(): Promise<void> {
  if (!selectedClub.value) return;
  renameError.value = null;
  if (renameName.value.trim().length < 2) {
    renameError.value = t("clubs.nameMinLength");
    return;
  }

  renameSubmitting.value = true;
  try {
    await clubs.updateClub(selectedClub.value.id, renameName.value.trim());
    renaming.value = false;
  } catch (error) {
    renameError.value = extractErrorMessage(error, t("clubs.genericServerError"));
  } finally {
    renameSubmitting.value = false;
  }
}

// --- assign player to selected club ---

const playerQuery = ref("");
const searchResults = ref<PlayerSearchResult[]>([]);
const searching = ref(false);
const assigning = ref(false);
const rosterError = ref<string | null>(null);

const rosterIds = computed(() => new Set(clubs.players.map((p) => p.playerId)));

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

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

/** Assigns a chosen player from the search results to the selected club. */
async function onAssign(player: PlayerSearchResult): Promise<void> {
  if (!selectedClub.value) return;
  rosterError.value = null;
  assigning.value = true;
  try {
    await clubs.assignPlayer(selectedClub.value.id, player.id);
    playerQuery.value = "";
    searchResults.value = [];
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("clubs.genericServerError"));
  } finally {
    assigning.value = false;
  }
}

/** Removes a player from the selected club. */
async function onRemove(playerId: string): Promise<void> {
  if (!selectedClub.value) return;
  rosterError.value = null;
  try {
    await clubs.removePlayer(selectedClub.value.id, playerId);
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("clubs.genericServerError"));
  }
}

// --- delete club ---

const deleting = ref(false);

/** Deletes the selected club, after confirmation. */
async function onDelete(): Promise<void> {
  if (!selectedClub.value) return;
  if (!window.confirm(t("clubs.deleteConfirm", { name: selectedClub.value.name }))) {
    return;
  }

  rosterError.value = null;
  deleting.value = true;
  try {
    await clubs.deleteClub(selectedClub.value.id);
    selectedClubId.value = null;
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("clubs.genericServerError"));
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-4xl flex-col gap-6 py-10 sm:py-12">
      <h1 class="text-2xl sm:text-3xl">{{ t("clubs.title") }}</h1>

      <p v-if="loading">{{ t("clubs.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("clubs.listTitle") }}</h2>
          <p class="mb-4 text-sm">{{ t("clubs.listSubtitle") }}</p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="createError" role="alert" class="banner banner--error mb-4">{{ createError }}</p>
          </Transition>

          <form class="mb-4 flex gap-2" novalidate @submit.prevent="onCreateClub">
            <label for="newClubName" class="sr-only">{{ t("clubs.newClubPlaceholder") }}</label>
            <input
              id="newClubName"
              v-model="newClubName"
              type="text"
              class="flex-1"
              :placeholder="t('clubs.newClubPlaceholder')"
            />
            <button type="submit" class="btn btn-primary shrink-0" :disabled="createSubmitting">
              {{ createSubmitting ? t("clubs.creating") : t("clubs.createButton") }}
            </button>
          </form>

          <p v-if="clubs.clubs.length === 0" class="text-sm text-text-muted">{{ t("clubs.empty") }}</p>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="club in clubs.clubs" :key="club.id">
              <button
                type="button"
                class="w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors"
                :class="
                  club.id === selectedClubId
                    ? 'border-accent bg-accent/10 font-semibold'
                    : 'border-border-soft hover:border-accent/40'
                "
                @click="selectClub(club.id)"
              >
                {{ club.name }}
              </button>
            </li>
          </ul>
        </section>

        <section v-if="selectedClub" class="card">
          <div class="mb-1 flex items-center justify-between gap-2">
            <h2 class="text-lg">{{ selectedClub.name }}</h2>
            <div class="flex gap-2">
              <button type="button" class="btn btn-ghost" @click="renaming = !renaming">
                {{ t("clubs.renameButton") }}
              </button>
              <button type="button" class="btn btn-ghost" :disabled="deleting" @click="onDelete">
                {{ t("clubs.deleteButton") }}
              </button>
            </div>
          </div>

          <form v-if="renaming" class="mb-4 flex gap-2" novalidate @submit.prevent="onRename">
            <label for="renameClubName" class="sr-only">{{ t("clubs.renameButton") }}</label>
            <input id="renameClubName" v-model="renameName" type="text" class="flex-1" />
            <button type="submit" class="btn btn-primary shrink-0" :disabled="renameSubmitting">
              {{ renameSubmitting ? t("clubs.saving") : t("clubs.saveButton") }}
            </button>
          </form>
          <p v-if="renameError" role="alert" class="banner banner--error mb-4">{{ renameError }}</p>

          <p class="mb-4 text-sm">{{ t("clubs.rosterSubtitle") }}</p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="rosterError" role="alert" class="banner banner--error mb-4">{{ rosterError }}</p>
          </Transition>

          <div class="field relative">
            <label for="clubPlayerQuery">{{ t("clubs.searchLabel") }}</label>
            <input id="clubPlayerQuery" v-model="playerQuery" type="text" :placeholder="t('clubs.searchPlaceholder')" />

            <ul
              v-if="playerQuery.trim()"
              class="mt-2 list-none overflow-hidden rounded-lg border border-border-soft p-0"
            >
              <li v-if="searching" class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("clubs.searching") }}</li>
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
                    :disabled="assigning || rosterIds.has(player.id)"
                    @click="onAssign(player)"
                  >
                    {{ rosterIds.has(player.id) ? t("clubs.alreadyInClub") : t("clubs.assign") }}
                  </button>
                </li>
              </template>
              <li v-else class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("clubs.noResults") }}</li>
            </ul>
          </div>

          <div v-if="clubs.players.length > 0" class="mt-4 flex flex-col gap-2">
            <div
              v-for="player in clubs.players"
              :key="player.playerId"
              class="flex items-center justify-between gap-3 rounded-lg border border-border-soft px-3.5 py-2.5"
            >
              <div class="flex flex-col gap-0.5">
                <strong class="text-sm text-text">{{ player.name }}</strong>
                <span class="text-sm text-text-muted">{{ player.universityCode }} · {{ player.program }}</span>
              </div>
              <button type="button" class="btn btn-ghost" @click="onRemove(player.playerId)">
                {{ t("clubs.remove") }}
              </button>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-text-muted">{{ t("clubs.noPlayers") }}</p>
        </section>

        <section v-else class="card flex items-center justify-center text-center text-sm text-text-muted">
          {{ t("clubs.selectHint") }}
        </section>
      </div>
    </main>
  </div>
</template>
