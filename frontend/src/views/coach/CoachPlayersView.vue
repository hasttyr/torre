<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { hasTournamentRoom } from "../../lib/tournamentAccess";
import { searchPlayers, type PlayerSearchResult } from "../../services/players";
import { useCoachesStore } from "../../stores/coaches";
import { useLocaleStore } from "../../stores/locale";

const coaches = useCoachesStore();
const locale = useLocaleStore();
const confirm = useConfirm();
const { t } = useI18n();

const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    await Promise.all([coaches.loadLinkedPlayers(), coaches.loadTournaments()]);
  } catch {
    loadError.value = t("coachPlayers.loadError");
  } finally {
    loading.value = false;
  }
});

const playerQuery = ref("");
const searchResults = ref<PlayerSearchResult[]>([]);
const searching = ref(false);
const linking = ref(false);
const actionError = ref<string | null>(null);

const linkedIds = computed(() => new Set(coaches.linkedPlayers.map((p) => p.playerId)));

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

/** Links a chosen player from the search results (HU24). */
async function onLink(player: PlayerSearchResult): Promise<void> {
  actionError.value = null;
  linking.value = true;
  try {
    await coaches.linkPlayer(player.id);
    playerQuery.value = "";
    searchResults.value = [];
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("coachPlayers.genericServerError"));
  } finally {
    linking.value = false;
  }
}

/** Unlinks a player from the current coach, after confirmation. */
async function onUnlink(player: { playerId: string; name: string }): Promise<void> {
  const confirmed = await confirm({
    title: t("coachPlayers.unlink"),
    message: t("coachPlayers.unlinkConfirm", { name: player.name }),
    confirmLabel: t("coachPlayers.unlink"),
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  actionError.value = null;
  try {
    await coaches.unlinkPlayer(player.playerId);
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("coachPlayers.genericServerError"));
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-6 py-10 sm:py-12">
      <div>
        <h1 class="text-2xl sm:text-3xl">{{ t("coachPlayers.title") }}</h1>
        <p class="mt-1 text-sm">{{ t("coachPlayers.subtitle") }}</p>
      </div>

      <p v-if="loading">{{ t("coachPlayers.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <section v-else class="card">
        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="actionError" role="alert" class="banner banner--error mb-4">{{ actionError }}</p>
        </Transition>

        <div class="field relative">
          <label for="coachPlayerQuery">{{ t("coachPlayers.searchLabel") }}</label>
          <input
            id="coachPlayerQuery"
            v-model="playerQuery"
            type="text"
            :placeholder="t('coachPlayers.searchPlaceholder')"
          />

          <ul v-if="playerQuery.trim()" class="mt-2 list-none overflow-hidden rounded-lg border border-border-soft p-0">
            <li v-if="searching" class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("coachPlayers.searching") }}</li>
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
                  :disabled="linking || linkedIds.has(player.id)"
                  @click="onLink(player)"
                >
                  {{ linkedIds.has(player.id) ? t("coachPlayers.alreadyLinked") : t("coachPlayers.link") }}
                </button>
              </li>
            </template>
            <li v-else class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("coachPlayers.noResults") }}</li>
          </ul>
        </div>

        <div v-if="coaches.linkedPlayers.length > 0" class="mt-4 flex flex-col gap-2">
          <div
            v-for="player in coaches.linkedPlayers"
            :key="player.playerId"
            class="flex items-center justify-between gap-3 rounded-lg border border-border-soft px-3.5 py-2.5"
          >
            <div class="flex flex-col gap-0.5">
              <strong class="text-sm text-text">{{ player.name }}</strong>
              <span class="text-sm text-text-muted">{{ player.universityCode }} · {{ player.program }}</span>
            </div>
            <button type="button" class="btn btn-ghost" @click="onUnlink(player)">
              {{ t("coachPlayers.unlink") }}
            </button>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-text-muted">{{ t("coachPlayers.empty") }}</p>
      </section>

      <section v-if="!loading && !loadError" class="card">
        <h2 class="mb-1 text-lg">{{ t("coachPlayers.tournamentsTitle") }}</h2>
        <p class="mb-4 text-sm">{{ t("coachPlayers.tournamentsSubtitle") }}</p>

        <p
          v-if="coaches.tournaments.length === 0"
          class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
        >
          {{ t("coachPlayers.tournamentsEmpty") }}
        </p>

        <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
          <li
            v-for="tournament in coaches.tournaments"
            :key="tournament.id"
            class="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-5"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-base">{{ tournament.name }}</h3>
              <span class="pill">{{ t(`estados.${tournament.status}`) }}</span>
            </div>
            <p class="text-sm text-text-muted">
              {{ formatDate(tournament.startDate, locale.locale) }} —
              {{ formatDate(tournament.endDate, locale.locale) }}
            </p>
            <p class="text-sm">
              {{ t("coachPlayers.myPlayersLabel") }}:
              {{ tournament.myPlayers.map((player) => player.name).join(", ") }}
            </p>
            <RouterLink
              v-if="hasTournamentRoom(tournament)"
              :to="`/torneos/${tournament.id}/sala`"
              class="self-start text-sm font-semibold text-accent"
            >
              {{ t("tournamentRoom.follow") }}
            </RouterLink>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
