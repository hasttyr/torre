<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import TournamentCard from "../../components/tournament/TournamentCard.vue";
import LoadError from "../../components/ui/LoadError.vue";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton.vue";
import { useQueryStatus } from "../../queries/status";
import { myTournamentsQuery } from "../../queries/tournaments";

const { t } = useI18n();
const query = useQuery(myTournamentsQuery);
const mine = computed(() => query.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(query, "dashboard.loadError");
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-8 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="page-title">{{ t("dashboard.title") }}</h1>
        <RouterLink to="/torneos/nuevo" class="btn btn-primary">{{ t("dashboard.createButton") }}</RouterLink>
      </header>

      <LoadingSkeleton v-if="loading" :label="t('dashboard.loading')" variant="list" />
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <p v-else-if="mine.length === 0" class="empty-state">
        {{ t("dashboard.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="tournament in mine" :key="tournament.id">
          <TournamentCard :tournament="tournament" :to="`/torneos/${tournament.id}`" :heading-level="2" />
        </li>
      </ul>
    </main>
  </div>
</template>
