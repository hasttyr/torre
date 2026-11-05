<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import TournamentCard from "../../components/tournament/TournamentCard.vue";
import LoadError from "../../components/ui/LoadError.vue";
import FormBanner from "../../components/ui/FormBanner.vue";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { hasTournamentRoom } from "../../lib/tournamentAccess";
import { useQueryStatus } from "../../queries/status";
import {
  availableTournamentsQuery,
  enrolledTournamentsQuery,
  invalidateTournamentLists,
} from "../../queries/tournaments";
import { enrollMe, withdrawMe } from "../../services/tournaments";

const { t } = useI18n();
// HU25 + the player's own registrations: side by side on the same page.
const enrolledQuery = useQuery(enrolledTournamentsQuery);
const availableQuery = useQuery(availableTournamentsQuery);
const enrolled = computed(() => enrolledQuery.data.value ?? []);
const available = computed(() => availableQuery.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus([enrolledQuery, availableQuery], "playerTournaments.loadError");

// HU25: the player joins a tournament with registration open by themselves,
// and can cancel it while it stays open. The server applies the same rules
// as when the organizer enrolls them (HU07); this page only shows its answer.
const cache = useQueryCache();
const confirm = useConfirm();
const enrolledIds = computed(() => new Set(enrolled.value.map((tournament) => tournament.id)));
const busy = ref<string | null>(null);
const actionError = ref<string | null>(null);

async function act(tournamentId: string, action: (id: string) => Promise<void>): Promise<void> {
  actionError.value = null;
  busy.value = tournamentId;
  try {
    await action(tournamentId);
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("common.genericServerError"));
  } finally {
    await invalidateTournamentLists(cache);
    busy.value = null;
  }
}

const onEnroll = (tournamentId: string) => act(tournamentId, enrollMe);

async function onWithdraw(tournamentId: string): Promise<void> {
  const confirmed = await confirm({
    title: t("playerTournaments.withdraw"),
    message: t("playerTournaments.withdrawConfirm"),
    confirmLabel: t("playerTournaments.withdraw"),
    danger: true,
  });
  if (confirmed) await act(tournamentId, withdrawMe);
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-8 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <!-- The page's title for the outline (the nav already names it on
           screen); each section is an h2 and each tournament an h3. -->
      <h1 class="sr-only">{{ t("header.tournaments") }}</h1>
      <LoadingSkeleton v-if="loading" :label="t('playerTournaments.loading')" variant="list" />
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <template v-else>
        <FormBanner v-if="actionError" kind="error">{{ actionError }}</FormBanner>

        <section class="flex flex-col gap-4">
          <div>
            <h2 class="text-2xl sm:text-3xl">{{ t("playerTournaments.myRegistrationsTitle") }}</h2>
            <p class="mt-1 text-sm">{{ t("playerTournaments.myRegistrationsSubtitle") }}</p>
          </div>

          <p v-if="enrolled.length === 0" class="empty-state">
            {{ t("playerTournaments.myRegistrationsEmpty") }}
          </p>

          <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
            <li v-for="tournament in enrolled" :key="tournament.id">
              <TournamentCard :tournament="tournament">
                <RouterLink
                  v-if="hasTournamentRoom(tournament)"
                  :to="`/torneos/${tournament.id}/sala`"
                  class="mt-1 inline-block text-sm font-semibold text-accent"
                >
                  {{ tournament.status === "FINISHED" ? t("tournamentRoom.results") : t("tournamentRoom.follow") }}
                </RouterLink>
              </TournamentCard>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-4">
          <div>
            <h2 class="text-xl sm:text-2xl">{{ t("playerTournaments.availableTitle") }}</h2>
            <p class="mt-1 text-sm">{{ t("playerTournaments.availableSubtitle") }}</p>
          </div>

          <p v-if="available.length === 0" class="empty-state">
            {{ t("playerTournaments.availableEmpty") }}
          </p>

          <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
            <li v-for="tournament in available" :key="tournament.id">
              <TournamentCard :tournament="tournament">
                <button
                  v-if="enrolledIds.has(tournament.id)"
                  type="button"
                  class="btn btn-ghost mt-1 self-start px-4 py-2 text-sm"
                  :disabled="busy !== null"
                  @click="onWithdraw(tournament.id)"
                >
                  {{ t("playerTournaments.withdraw") }}
                </button>
                <button
                  v-else
                  type="button"
                  class="btn btn-primary mt-1 self-start px-4 py-2 text-sm"
                  :disabled="busy !== null"
                  @click="onEnroll(tournament.id)"
                >
                  {{ t("playerTournaments.enroll") }}
                </button>
              </TournamentCard>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
