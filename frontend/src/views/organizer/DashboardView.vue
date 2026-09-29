<script setup lang="ts">
import { useQuery } from "@pinia/colada";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import TournamentCard from "../../components/tournament/TournamentCard.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { useQueryStatus } from "../../queries/status";
import { myTournamentsQuery } from "../../queries/tournaments";

const { t } = useI18n();
const query = useQuery(myTournamentsQuery);
const mine = computed(() => query.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(query, "dashboard.loadError");
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-6 py-10 sm:py-12">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl sm:text-3xl">{{ t("dashboard.title") }}</h1>
        <RouterLink to="/torneos/nuevo" class="btn btn-primary">{{ t("dashboard.createButton") }}</RouterLink>
      </header>

      <p v-if="loading">{{ t("dashboard.loading") }}</p>
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <p
        v-else-if="mine.length === 0"
        class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
      >
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
