<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import TournamentCard from "../../components/tournament/TournamentCard.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { useQueryStatus } from "../../queries/status";
import { liveTournamentsQuery } from "../../queries/tournaments";

// HU18: where players, coaches and arbiters find the tournaments being
// played (and those already played) to follow them in their room.
const { t } = useI18n();

const query = useQuery(liveTournamentsQuery);
const tournaments = computed(() => query.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(query, "liveTournaments.loadError");
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-2xl flex-col gap-6 py-10 sm:py-12">
      <div>
        <h1 class="text-2xl sm:text-3xl">{{ t("liveTournaments.title") }}</h1>
        <p class="mt-1 text-sm">{{ t("liveTournaments.subtitle") }}</p>
      </div>

      <p v-if="loading">{{ t("liveTournaments.loading") }}</p>
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />
      <p
        v-else-if="tournaments.length === 0"
        class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
      >
        {{ t("liveTournaments.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="tournament in tournaments" :key="tournament.id">
          <TournamentCard :tournament="tournament" :to="`/torneos/${tournament.id}/sala`" :heading-level="2" />
        </li>
      </ul>
    </main>
  </div>
</template>
