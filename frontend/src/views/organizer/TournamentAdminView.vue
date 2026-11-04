<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton.vue";
import PlayerEnrollmentPanel from "../../components/tournament-admin/PlayerEnrollmentPanel.vue";
import RegistrationControls from "../../components/tournament-admin/RegistrationControls.vue";
import RoundManager from "../../components/tournament-admin/RoundManager.vue";
import TournamentConfigForm from "../../components/tournament-admin/TournamentConfigForm.vue";
import { useQueryStatus } from "../../queries/status";
import { enrolledPlayersQuery, tournamentQuery } from "../../queries/tournaments";

const route = useRoute();
const tournamentId = String(route.params.id);
const { t } = useI18n();

// Usually already on their way: the route prefetches both (router/index.ts).
const tournamentEntry = useQuery(tournamentQuery(tournamentId));
const rosterEntry = useQuery(enrolledPlayersQuery(tournamentId));
const tournament = computed(() => tournamentEntry.data.value ?? null);
const { loading, loadError, retry } = useQueryStatus([tournamentEntry, rosterEntry], "tournamentAdmin.loadError");

// Rounds only exist once registration is closed (HU08); before that the
// round manager would have nothing to show.
const PLAY_STATUSES = ["REGISTRATION_CLOSED", "IN_PROGRESS", "FINISHED"];
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-3xl flex-col gap-8 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <LoadingSkeleton v-if="loading" :label="t('tournamentAdmin.loading')" variant="room" />
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <template v-else-if="tournament">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="page-title">{{ tournament.name }}</h1>
          <span class="pill">{{ t(`estados.${tournament.status}`) }}</span>
        </header>

        <!-- HU08, HU09, HU17, HU29 -->
        <RoundManager v-if="PLAY_STATUSES.includes(tournament.status)" :tournament-id="tournamentId" />

        <!-- HU05 -->
        <TournamentConfigForm :tournament-id="tournamentId" />

        <!-- HU06 -->
        <RegistrationControls :tournament-id="tournamentId" />

        <!-- HU07 -->
        <PlayerEnrollmentPanel :tournament-id="tournamentId" />
      </template>
    </main>
  </div>
</template>
