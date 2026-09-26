<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import PlayerEnrollmentPanel from "../../components/tournament-admin/PlayerEnrollmentPanel.vue";
import RegistrationControls from "../../components/tournament-admin/RegistrationControls.vue";
import RoundManager from "../../components/tournament-admin/RoundManager.vue";
import TournamentConfigForm from "../../components/tournament-admin/TournamentConfigForm.vue";
import { loadTournamentAdmin } from "../../lib/pageData";
import { DATA_KEYS, takeData } from "../../lib/routeData";
import { useTournamentsStore } from "../../stores/tournaments";

const route = useRoute();
const tournaments = useTournamentsStore();
const tournamentId = String(route.params.id);
const { t } = useI18n();

const loadError = ref<string | null>(null);
const loading = ref(true);

// Rounds only exist once registration is closed (HU08); before that the
// round manager would have nothing to show.
const PLAY_STATUSES = ["REGISTRATION_CLOSED", "IN_PROGRESS", "FINISHED"];

onMounted(async () => {
  try {
    // Usually already on its way: the route started it (lib/routeData.ts).
    await takeData(DATA_KEYS.tournamentAdmin(tournamentId), () => loadTournamentAdmin(tournamentId));
  } catch {
    loadError.value = t("tournamentAdmin.loadError");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-3xl flex-col gap-6 py-10 sm:py-12">
      <p v-if="loading">{{ t("tournamentAdmin.loading") }}</p>
      <LoadError v-else-if="loadError" :message="loadError" />

      <template v-else-if="tournaments.current">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-2xl sm:text-3xl">{{ tournaments.current.name }}</h1>
          <span class="pill">{{ t(`estados.${tournaments.current.status}`) }}</span>
        </header>

        <!-- HU08, HU09, HU17, HU29 -->
        <RoundManager v-if="PLAY_STATUSES.includes(tournaments.current.status)" :tournament-id="tournamentId" />

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
