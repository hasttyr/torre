<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { useQueryParam } from "../../lib/useQueryParam";
import {
  addClub,
  addToRoster,
  clubPlayersQuery,
  clubsQuery,
  removeClub,
  removeFromRoster,
  replaceClub,
} from "../../queries/clubs";
import { useQueryStatus } from "../../queries/status";
import { assignPlayerToClub, createClub, deleteClub, removePlayerFromClub, updateClub } from "../../services/clubs";
import type { PlayerSearchResult } from "../../services/players";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";
import PlayerSearchPicker from "../../components/ui/PlayerSearchPicker.vue";

const cache = useQueryCache();
const confirm = useConfirm();
const { t } = useI18n();

const clubsEntry = useQuery(clubsQuery);
const clubs = computed(() => clubsEntry.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(clubsEntry, "clubs.loadError");

// The selected club lives in the URL (?club=<id>), so a link opens its roster.
const clubParam = useQueryParam("club");
const selectedClubId = computed(() => clubParam.value || null);
const selectedClub = computed(() => clubs.value.find((club) => club.id === selectedClubId.value) ?? null);

// The selected club's roster, once the club is known to exist (a stale link
// just shows the list). Whatever selects a club (a click, a new club,
// back/forward, a link) loads it.
const rosterEntry = useQuery(() => ({
  ...clubPlayersQuery(selectedClub.value?.id ?? ""),
  enabled: selectedClub.value !== null,
}));
const players = computed(() => rosterEntry.data.value ?? []);
const rosterLoading = computed(() => selectedClub.value !== null && rosterEntry.status.value === "pending");

/** Selects a club; its roster loads with it. */
function selectClub(clubId: string): void {
  clubParam.value = clubId;
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
    const club = await createClub(newClubName.value.trim());
    addClub(cache, club);
    newClubName.value = "";
    selectClub(club.id);
  } catch (error) {
    createError.value = extractErrorMessage(error, t("common.genericServerError"));
  } finally {
    createSubmitting.value = false;
  }
}

// --- rename club ---

const renaming = ref(false);
const renameName = ref("");
const renameError = ref<string | null>(null);
const renameSubmitting = ref(false);

// A different club closes the rename form. Only a different one: the list is
// read again in the background, and that mustn't wipe a name being typed.
watch(selectedClubId, () => {
  renaming.value = false;
  renameError.value = null;
});

/** Opens (with the club's current name) or closes the rename form. */
function toggleRename(): void {
  renaming.value = !renaming.value;
  renameName.value = selectedClub.value?.name ?? "";
  renameError.value = null;
}

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
    replaceClub(cache, await updateClub(selectedClub.value.id, renameName.value.trim()));
    renaming.value = false;
  } catch (error) {
    renameError.value = extractErrorMessage(error, t("common.genericServerError"));
  } finally {
    renameSubmitting.value = false;
  }
}

// --- assign player to selected club ---

const assigning = ref(false);
const rosterError = ref<string | null>(null);

const rosterIds = computed(() => new Set(players.value.map((p) => p.playerId)));
// What went wrong with the roster: an action on it, or loading it.
const rosterMessage = computed(
  () =>
    rosterError.value ??
    (rosterEntry.status.value === "error"
      ? extractErrorMessage(rosterEntry.error.value, t("common.genericServerError"))
      : null),
);

/** Assigns a chosen player from the search results to the selected club; answers whether it worked. */
async function onAssign(player: PlayerSearchResult): Promise<boolean> {
  if (!selectedClub.value) return false;
  rosterError.value = null;
  assigning.value = true;
  try {
    addToRoster(cache, selectedClub.value.id, await assignPlayerToClub(selectedClub.value.id, player.id));
    return true;
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("common.genericServerError"));
    return false;
  } finally {
    assigning.value = false;
  }
}

/** Removes a player from the selected club, after confirmation. */
async function onRemove(player: { playerId: string; name: string }): Promise<void> {
  const club = selectedClub.value;
  if (!club) return;
  const confirmed = await confirm({
    title: t("clubs.remove"),
    message: t("clubs.removeConfirm", { name: player.name, club: club.name }),
    confirmLabel: t("clubs.remove"),
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  rosterError.value = null;
  try {
    await removePlayerFromClub(club.id, player.playerId);
    removeFromRoster(cache, club.id, player.playerId);
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("common.genericServerError"));
  }
}

// --- delete club ---

const deleting = ref(false);

/** Deletes the selected club, after confirmation. */
async function onDelete(): Promise<void> {
  if (!selectedClub.value) return;
  const confirmed = await confirm({
    title: t("clubs.deleteButton"),
    message: t("clubs.deleteConfirm", { name: selectedClub.value.name }),
    confirmLabel: t("clubs.deleteButton"),
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  rosterError.value = null;
  deleting.value = true;
  try {
    const clubId = selectedClub.value.id;
    await deleteClub(clubId);
    removeClub(cache, clubId);
    clubParam.value = "";
  } catch (error) {
    rosterError.value = extractErrorMessage(error, t("common.genericServerError"));
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
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("clubs.listTitle") }}</h2>
          <p class="mb-4 text-sm">{{ t("clubs.listSubtitle") }}</p>

          <FadeSlide>
            <FormBanner v-if="createError" kind="error" class="mb-4">{{ createError }}</FormBanner>
          </FadeSlide>

          <form class="mb-4 flex gap-2" novalidate @submit.prevent="onCreateClub">
            <label for="newClubName" class="sr-only">{{ t("clubs.newClubPlaceholder") }}</label>
            <input
              id="newClubName"
              v-model="newClubName"
              type="text"
              name="newClubName"
              autocomplete="off"
              class="flex-1"
              :placeholder="t('clubs.newClubPlaceholder')"
            />
            <button type="submit" class="btn btn-primary shrink-0" :disabled="createSubmitting">
              {{ createSubmitting ? t("clubs.creating") : t("clubs.createButton") }}
            </button>
          </form>

          <p v-if="clubs.length === 0" class="text-sm text-text-muted">{{ t("clubs.empty") }}</p>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="club in clubs" :key="club.id">
              <button
                type="button"
                class="w-full rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors"
                :class="
                  club.id === selectedClubId
                    ? 'border-accent bg-accent/10 font-semibold'
                    : 'border-border-soft hover:border-accent/40'
                "
                :aria-pressed="club.id === selectedClubId"
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
              <button type="button" class="btn btn-ghost" @click="toggleRename">
                {{ t("clubs.renameButton") }}
              </button>
              <button type="button" class="btn btn-ghost" :disabled="deleting" @click="onDelete">
                {{ t("clubs.deleteButton") }}
              </button>
            </div>
          </div>

          <form v-if="renaming" class="mb-4 flex gap-2" novalidate @submit.prevent="onRename">
            <label for="renameClubName" class="sr-only">{{ t("clubs.renameButton") }}</label>
            <input
              id="renameClubName"
              v-model="renameName"
              type="text"
              name="renameClubName"
              autocomplete="off"
              class="flex-1"
            />
            <button type="submit" class="btn btn-primary shrink-0" :disabled="renameSubmitting">
              {{ renameSubmitting ? t("clubs.saving") : t("clubs.saveButton") }}
            </button>
          </form>
          <FormBanner v-if="renameError" kind="error" class="mb-4">{{ renameError }}</FormBanner>

          <p class="mb-4 text-sm">{{ t("clubs.rosterSubtitle") }}</p>

          <FadeSlide>
            <FormBanner v-if="rosterMessage" kind="error" class="mb-4">{{ rosterMessage }}</FormBanner>
          </FadeSlide>

          <PlayerSearchPicker
            id="clubPlayerQuery"
            :label="t('clubs.searchLabel')"
            :placeholder="t('clubs.searchPlaceholder')"
            :action-label="t('clubs.assign')"
            :added-label="t('clubs.alreadyInClub')"
            :is-added="(player) => rosterIds.has(player.id)"
            :busy="assigning"
            :pick="onAssign"
          />

          <p v-if="rosterLoading" class="mt-4 text-sm text-text-muted" role="status">
            {{ t("clubs.rosterLoading") }}
          </p>
          <div v-else-if="players.length > 0" class="mt-4 flex flex-col gap-2">
            <div
              v-for="player in players"
              :key="player.playerId"
              class="flex items-center justify-between gap-3 rounded-lg border border-border-soft px-3.5 py-2.5"
            >
              <div class="flex flex-col gap-0.5">
                <strong class="text-sm text-text">{{ player.name }}</strong>
                <span class="text-sm text-text-muted">{{ player.universityCode }} · {{ player.program }}</span>
              </div>
              <button type="button" class="btn btn-ghost" @click="onRemove(player)">
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
