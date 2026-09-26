<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import { extractErrorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { listLiveTournaments, type Tournament } from "../../services/tournaments";
import { useLocaleStore } from "../../stores/locale";

// HU18: where players, coaches and arbiters find the tournaments being
// played (and those already played) to follow them in their room.
const { t } = useI18n();
const locale = useLocaleStore();

const tournaments = ref<Tournament[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    tournaments.value = await listLiveTournaments();
  } catch (error) {
    loadError.value = extractErrorMessage(error, t("liveTournaments.loadError"));
  } finally {
    loading.value = false;
  }
});
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
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>
      <p
        v-else-if="tournaments.length === 0"
        class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
      >
        {{ t("liveTournaments.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="tournament in tournaments" :key="tournament.id">
          <RouterLink
            :to="`/torneos/${tournament.id}/sala`"
            class="flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-surface p-5 text-inherit no-underline transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 class="text-base">{{ tournament.name }}</h2>
              <p class="mt-0.5 text-sm">
                {{ formatDate(tournament.startDate, locale.locale) }} —
                {{ formatDate(tournament.endDate, locale.locale) }}
              </p>
            </div>
            <span class="pill">{{ t(`estados.${tournament.status}`) }}</span>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>
