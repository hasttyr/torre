<script setup lang="ts">
import { onMounted, ref } from "vue";

import AppHeader from "../components/AppHeader.vue";
import { useTorneosStore } from "../stores/torneos";

const torneos = useTorneosStore();
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    await torneos.cargarMisTorneos();
  } catch {
    loadError.value = "No se pudieron cargar tus torneos";
  } finally {
    loading.value = false;
  }
});

const ESTADO_LABELS: Record<string, string> = {
  CREADO: "Preliminar",
  INSCRIPCIONES_ABIERTAS: "Inscripciones abiertas",
  INSCRIPCIONES_CERRADAS: "Inscripciones cerradas",
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
};

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-6 py-10 sm:py-12">
      <header class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl sm:text-3xl">Mis torneos</h1>
        <RouterLink to="/torneos/nuevo" class="btn btn-primary">+ Crear torneo</RouterLink>
      </header>

      <p v-if="loading">Cargando torneos…</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <p v-else-if="torneos.mios.length === 0" class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted">
        Todavía no administrás ningún torneo. Creá el primero para empezar.
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-3 p-0">
        <li v-for="torneo in torneos.mios" :key="torneo.id">
          <RouterLink
            :to="`/torneos/${torneo.id}`"
            class="tournament-card flex flex-col items-start gap-2 rounded-2xl border border-border-soft bg-surface p-5 text-inherit no-underline transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div>
              <h2 class="text-base">{{ torneo.nombre }}</h2>
              <p class="mt-0.5 text-sm">{{ formatFecha(torneo.fechaInicio) }} — {{ formatFecha(torneo.fechaFin) }}</p>
            </div>
            <span class="pill">{{ ESTADO_LABELS[torneo.estado] ?? torneo.estado }}</span>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>
