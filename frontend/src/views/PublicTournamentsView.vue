<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../components/layout/AppHeader.vue";
import TournamentCard from "../components/tournament/TournamentCard.vue";
import LoadError from "../components/ui/LoadError.vue";
import LoadingSkeleton from "../components/ui/LoadingSkeleton.vue";
import { useQueryStatus } from "../queries/status";
import { publicTournamentsQuery } from "../queries/tournaments";
import type { PublicTournament } from "../services/tournaments";

// HU25 / RF17: the tournaments open for registration, for a visitor who
// hasn't signed in. Only the tournament's own facts: the API sends nothing
// about a person, not even who organizes it.
const { t } = useI18n();

const query = useQuery(publicTournamentsQuery);
const tournaments = computed(() => query.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(query, "publicTournaments.loadError");

/** Rounds, time control and who may join, as one line. */
function details(tournament: PublicTournament): string {
  return [
    tournament.roundsCount != null ? t("publicTournaments.rounds", { count: tournament.roundsCount }) : null,
    tournament.timeControl ? t("publicTournaments.timeControl", { timeControl: tournament.timeControl }) : null,
    tournament.restrictedProgram ? t("publicTournaments.program", { program: tournament.restrictedProgram }) : null,
    tournament.minimumSemester != null
      ? t("publicTournaments.minimumSemester", { semester: tournament.minimumSemester })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-2xl flex-col gap-8 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <div>
        <h1 class="page-title">{{ t("publicTournaments.title") }}</h1>
        <p class="mt-3">
          {{ t("publicTournaments.subtitle") }}
          <RouterLink to="/login" class="font-semibold text-accent">{{ t("header.login") }}</RouterLink>
          ·
          <RouterLink to="/registro" class="font-semibold text-accent">{{ t("header.createAccount") }}</RouterLink>
        </p>
      </div>

      <LoadingSkeleton v-if="loading" :label="t('publicTournaments.loading')" variant="list" />
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />
      <p v-else-if="tournaments.length === 0" class="empty-state">
        {{ t("publicTournaments.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="tournament in tournaments" :key="tournament.id">
          <TournamentCard :tournament="tournament" :heading-level="2">
            <p v-if="details(tournament)" class="text-sm text-text-muted">{{ details(tournament) }}</p>
          </TournamentCard>
        </li>
      </ul>
    </main>
  </div>
</template>
