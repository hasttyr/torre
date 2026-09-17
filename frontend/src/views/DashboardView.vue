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
  <div class="page">
    <AppHeader />

    <main class="container dashboard">
      <header class="dashboard-header">
        <h1>Mis torneos</h1>
        <RouterLink to="/torneos/nuevo" class="btn btn-primary">+ Crear torneo</RouterLink>
      </header>

      <p v-if="loading">Cargando torneos…</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <p v-else-if="torneos.mios.length === 0" class="empty-state">
        Todavía no administrás ningún torneo. Creá el primero para empezar.
      </p>

      <ul v-else class="tournament-list">
        <li v-for="torneo in torneos.mios" :key="torneo.id">
          <RouterLink :to="`/torneos/${torneo.id}`" class="tournament-card">
            <div class="tournament-card__main">
              <h2>{{ torneo.nombre }}</h2>
              <p class="tournament-card__dates">
                {{ formatFecha(torneo.fechaInicio) }} — {{ formatFecha(torneo.fechaFin) }}
              </p>
            </div>
            <span class="estado-pill">{{ ESTADO_LABELS[torneo.estado] ?? torneo.estado }}</span>
          </RouterLink>
        </li>
      </ul>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.dashboard {
  padding-block: 3rem;
  max-width: 40rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.empty-state {
  color: var(--text-muted);
  background: var(--surface);
  border: 1px dashed var(--border-soft);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;
}

.tournament-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tournament-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: 1.1rem 1.4rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease;
}

.tournament-card:hover {
  border-color: var(--accent-border);
}

.tournament-card__main h2 {
  margin: 0;
  font-size: 1.05rem;
}

.tournament-card__dates {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.estado-pill {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--text);
  white-space: nowrap;
}
</style>
