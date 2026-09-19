<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import PlayerEnrollmentPanel from "../components/tournament-admin/PlayerEnrollmentPanel.vue";
import RegistrationControls from "../components/tournament-admin/RegistrationControls.vue";
import TournamentConfigForm from "../components/tournament-admin/TournamentConfigForm.vue";
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

    <main class="container flex max-w-xl flex-col gap-6 py-10 sm:py-12">
      <p v-if="loading">{{ t("tournamentAdmin.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <template v-else-if="tournaments.current">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-2xl sm:text-3xl">{{ tournaments.current.name }}</h1>
          <span class="pill">{{ t(`estados.${tournaments.current.status}`) }}</span>
        </header>

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
