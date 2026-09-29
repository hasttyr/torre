<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { hasTournamentRoom } from "../../lib/tournamentAccess";
import { addLinkedPlayer, coachTournamentsQuery, linkedPlayersQuery, removeLinkedPlayer } from "../../queries/coaches";
import { useQueryStatus } from "../../queries/status";
import { linkPlayer, unlinkPlayer } from "../../services/coaches";
import type { PlayerSearchResult } from "../../services/players";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";
import PlayerSearchPicker from "../../components/ui/PlayerSearchPicker.vue";
import TournamentCard from "../../components/tournament/TournamentCard.vue";

const cache = useQueryCache();
const confirm = useConfirm();
const { t } = useI18n();

const playersEntry = useQuery(linkedPlayersQuery);
const tournamentsEntry = useQuery(coachTournamentsQuery);
const linkedPlayers = computed(() => playersEntry.data.value ?? []);
const tournaments = computed(() => tournamentsEntry.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus([playersEntry, tournamentsEntry], "coachPlayers.loadError");

const linking = ref(false);
const actionError = ref<string | null>(null);

const linkedIds = computed(() => new Set(linkedPlayers.value.map((p) => p.playerId)));

/** Links a chosen player from the search results (HU24); answers whether it worked. */
async function onLink(player: PlayerSearchResult): Promise<boolean> {
  actionError.value = null;
  linking.value = true;
  try {
    addLinkedPlayer(cache, await linkPlayer(player.id));
    return true;
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("common.genericServerError"));
    return false;
  } finally {
    linking.value = false;
  }
}

/** Stops following a player: straight away for a pending request (nothing was shared yet), else after confirming. */
async function onUnlink(player: { playerId: string; name: string; acceptedAt: string | null }): Promise<void> {
  const confirmed =
    player.acceptedAt === null ||
    (await confirm({
      title: t("coachPlayers.unlink"),
      message: t("coachPlayers.unlinkConfirm", { name: player.name }),
      confirmLabel: t("coachPlayers.unlink"),
      danger: true,
    }));
  if (!confirmed) {
    return;
  }

  actionError.value = null;
  try {
    await unlinkPlayer(player.playerId);
    removeLinkedPlayer(cache, player.playerId);
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("common.genericServerError"));
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
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <section v-else class="card">
        <FadeSlide>
          <FormBanner v-if="actionError" kind="error" class="mb-4">{{ actionError }}</FormBanner>
        </FadeSlide>

        <PlayerSearchPicker
          id="coachPlayerQuery"
          :label="t('coachPlayers.searchLabel')"
          :placeholder="t('coachPlayers.searchPlaceholder')"
          :action-label="t('coachPlayers.link')"
          :added-label="t('coachPlayers.alreadyLinked')"
          :is-added="(player) => linkedIds.has(player.id)"
          :busy="linking"
          :pick="onLink"
        />

        <div v-if="linkedPlayers.length > 0" class="mt-4 flex flex-col gap-2">
          <div
            v-for="player in linkedPlayers"
            :key="player.playerId"
            data-linked-player
            class="flex items-center justify-between gap-3 rounded-lg border border-border-soft px-3.5 py-2.5"
          >
            <div class="flex flex-col gap-0.5">
              <strong class="text-sm text-text">{{ player.name }}</strong>
              <span class="text-sm text-text-muted">{{ player.universityCode }} · {{ player.program }}</span>
              <span v-if="player.acceptedAt === null" class="text-xs font-semibold text-text-faint">
                {{ t("coachPlayers.pending") }}
              </span>
            </div>
            <button type="button" class="btn btn-ghost" @click="onUnlink(player)">
              {{ player.acceptedAt === null ? t("coachPlayers.cancelRequest") : t("coachPlayers.unlink") }}
            </button>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-text-muted">{{ t("coachPlayers.empty") }}</p>
      </section>

      <section v-if="!loading && !loadError" class="card">
        <h2 class="mb-1 text-lg">{{ t("coachPlayers.tournamentsTitle") }}</h2>
        <p class="mb-4 text-sm">{{ t("coachPlayers.tournamentsSubtitle") }}</p>

        <p
          v-if="tournaments.length === 0"
          class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
        >
          {{ t("coachPlayers.tournamentsEmpty") }}
        </p>

        <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
          <li v-for="tournament in tournaments" :key="tournament.id">
            <TournamentCard :tournament="tournament">
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
            </TournamentCard>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
