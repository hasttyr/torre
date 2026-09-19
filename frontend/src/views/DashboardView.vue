<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../components/AppHeader.vue";
import { useLocaleStore } from "../stores/locale";
import { useTournamentsStore } from "../stores/tournaments";

const tournaments = useTournamentsStore();
const locale = useLocaleStore();
const { t } = useI18n();
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    await tournaments.loadMyTournaments();
  } catch {
    loadError.value = t("dashboard.loadError");
  } finally {
    loading.value = false;
  }
});

/** Formats an ISO date string using the active locale. */
function formatDate(date: string): string {
  const localeTag = locale.locale;
  return new Date(date).toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" });
}
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
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <p
        v-else-if="tournaments.mine.length === 0"
        class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
      >
        {{ t("dashboard.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="tournament in tournaments.mine" :key="tournament.id">
          <RouterLink
            :to="`/torneos/${tournament.id}`"
            class="tournament-card flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-surface p-5 text-inherit no-underline transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div>
              <h2 class="text-base">{{ tournament.name }}</h2>
              <p class="mt-0.5 text-sm">
                {{ formatDate(tournament.startDate) }} — {{ formatDate(tournament.endDate) }}
              </p>
            </div>
            <span class="pill">{{ t(`estados.${tournament.status}`) }}</span>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>
