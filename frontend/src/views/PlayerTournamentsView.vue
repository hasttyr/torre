<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../components/AppHeader.vue";
import { useLocaleStore } from "../stores/locale";
import { useTorneosStore } from "../stores/torneos";

const torneos = useTorneosStore();
const locale = useLocaleStore();
const { t } = useI18n();
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    await torneos.cargarTorneosJugador();
  } catch {
    loadError.value = t("playerTournaments.loadError");
  } finally {
    loading.value = false;
  }
});

function formatFecha(fecha: string): string {
  const localeTag = locale.locale;
  return new Date(fecha).toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "numeric" });
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-8 py-10 sm:py-12">
      <p v-if="loading">{{ t("playerTournaments.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <template v-else>
        <section class="flex flex-col gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl">{{ t("playerTournaments.myRegistrationsTitle") }}</h1>
            <p class="mt-1 text-sm">{{ t("playerTournaments.myRegistrationsSubtitle") }}</p>
          </div>

          <p
            v-if="torneos.inscrito.length === 0"
            class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
          >
            {{ t("playerTournaments.myRegistrationsEmpty") }}
          </p>

          <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
            <li
              v-for="torneo in torneos.inscrito"
              :key="torneo.id"
              class="flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div>
                <h2 class="text-base">{{ torneo.nombre }}</h2>
                <p class="mt-0.5 text-sm">{{ formatFecha(torneo.fechaInicio) }} — {{ formatFecha(torneo.fechaFin) }}</p>
              </div>
              <span class="pill">{{ t(`estados.${torneo.estado}`) }}</span>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-4">
          <div>
            <h2 class="text-xl sm:text-2xl">{{ t("playerTournaments.availableTitle") }}</h2>
            <p class="mt-1 text-sm">{{ t("playerTournaments.availableSubtitle") }}</p>
          </div>

          <p
            v-if="torneos.disponibles.length === 0"
            class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
          >
            {{ t("playerTournaments.availableEmpty") }}
          </p>

          <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
            <li
              v-for="torneo in torneos.disponibles"
              :key="torneo.id"
              class="flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div>
                <h2 class="text-base">{{ torneo.nombre }}</h2>
                <p class="mt-0.5 text-sm">{{ formatFecha(torneo.fechaInicio) }} — {{ formatFecha(torneo.fechaFin) }}</p>
              </div>
              <span class="pill">{{ t(`estados.${torneo.estado}`) }}</span>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
