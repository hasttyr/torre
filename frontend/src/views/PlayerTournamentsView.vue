<script setup lang="ts">
import { onMounted, ref } from "vue";

import AppHeader from "../components/AppHeader.vue";
import { useTorneosStore } from "../stores/torneos";

const torneos = useTorneosStore();
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    await torneos.cargarTorneosJugador();
  } catch {
    loadError.value = "No se pudieron cargar los torneos";
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

    <main class="container flex max-w-xl flex-col gap-8 py-10 sm:py-12">
      <p v-if="loading">Cargando torneos…</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <template v-else>
        <section class="flex flex-col gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl">Mis inscripciones</h1>
            <p class="mt-1 text-sm">Torneos en los que ya estás registrado como jugador.</p>
          </div>

          <p
            v-if="torneos.inscrito.length === 0"
            class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
          >
            Todavía no estás inscrito en ningún torneo. El organizador es quien registra tu inscripción.
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
              <span class="pill">{{ ESTADO_LABELS[torneo.estado] ?? torneo.estado }}</span>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-4">
          <div>
            <h2 class="text-xl sm:text-2xl">Torneos disponibles</h2>
            <p class="mt-1 text-sm">Con inscripción abierta ahora mismo. Pedile al organizador que te registre.</p>
          </div>

          <p
            v-if="torneos.disponibles.length === 0"
            class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
          >
            No hay torneos con inscripción abierta en este momento.
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
              <span class="pill">{{ ESTADO_LABELS[torneo.estado] ?? torneo.estado }}</span>
            </li>
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>
