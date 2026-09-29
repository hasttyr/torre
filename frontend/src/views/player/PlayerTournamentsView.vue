<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import TournamentCard from "../../components/tournament/TournamentCard.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { hasTournamentRoom } from "../../lib/tournamentAccess";
import { useQueryStatus } from "../../queries/status";
import { availableTournamentsQuery, enrolledTournamentsQuery } from "../../queries/tournaments";

const { t } = useI18n();
// HU25 + the player's own registrations: side by side on the same page.
const enrolledQuery = useQuery(enrolledTournamentsQuery);
const availableQuery = useQuery(availableTournamentsQuery);
const enrolled = computed(() => enrolledQuery.data.value ?? []);
const available = computed(() => availableQuery.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus([enrolledQuery, availableQuery], "playerTournaments.loadError");
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-8 py-10 sm:py-12">
      <!-- The page's title for the outline (the nav already names it on
           screen); each section is an h2 and each tournament an h3. -->
      <h1 class="sr-only">{{ t("header.tournaments") }}</h1>
      <p v-if="loading">{{ t("playerTournaments.loading") }}</p>
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <template v-else>
        <section class="flex flex-col gap-4">
          <div>
            <h2 class="text-2xl sm:text-3xl">{{ t("playerTournaments.myRegistrationsTitle") }}</h2>
            <p class="mt-1 text-sm">{{ t("playerTournaments.myRegistrationsSubtitle") }}</p>
          </div>

          <p
            v-if="enrolled.length === 0"
            class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
          >
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
                  {{ t("tournamentRoom.follow") }}
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

          <p
            v-if="available.length === 0"
            class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
          >
            {{ t("playerTournaments.availableEmpty") }}
          </p>

          <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
            <li v-for="tournament in available" :key="tournament.id">
              <TournamentCard :tournament="tournament" />
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
