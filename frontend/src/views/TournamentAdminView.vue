<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import { buscarJugadores, type JugadorBusqueda } from "../services/jugadores";
import { useTorneosStore } from "../stores/torneos";

const route = useRoute();
const torneos = useTorneosStore();
const torneoId = String(route.params.id);

const loadError = ref<string | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    await torneos.cargar(torneoId);
  } catch {
    loadError.value = "No se pudo cargar el torneo";
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

// --- HU05: configurar torneo (rondas, ritmo, desempates) ---

const configForm = reactive({
  numeroRondas: "",
  ritmo: "",
  desempates: "Buchholz, Buchholz Cortado 1, Sonneborn-Berger, ARO",
});
const configSubmitting = ref(false);
const configError = ref<string | null>(null);
const configSuccess = ref<string | null>(null);

// RN-05: el orden de desempates solo puede modificarse en estado preliminar
// del torneo (antes de la ronda 1). El backend es quien decide realmente,
// esto solo evita un submit que ya se sabe que va a fallar.
const puedeEditarDesempates = computed(() => torneos.actual?.estado === "CREADO");

async function onConfigurar(): Promise<void> {
  configError.value = null;
  configSuccess.value = null;
  configSubmitting.value = true;
  try {
    const criteriosDesempate = configForm.desempates
      .split(",")
      .map((nombre) => nombre.trim())
      .filter(Boolean)
      .map((nombre, index) => ({ nombre, orden: index + 1 }));

    await torneos.configurar(torneoId, {
      numeroRondas: configForm.numeroRondas ? Number(configForm.numeroRondas) : undefined,
      ritmo: configForm.ritmo.trim() || undefined,
      criteriosDesempate: puedeEditarDesempates.value ? criteriosDesempate : undefined,
    });
    configSuccess.value = "Configuración guardada";
  } catch (error) {
    configError.value = extractError(error);
  } finally {
    configSubmitting.value = false;
  }
}

// --- HU06: abrir / cerrar inscripciones ---

const inscripcionesSubmitting = ref(false);
const inscripcionesError = ref<string | null>(null);

async function onAbrirInscripciones(): Promise<void> {
  inscripcionesError.value = null;
  inscripcionesSubmitting.value = true;
  try {
    await torneos.abrirInscripciones(torneoId);
  } catch (error) {
    inscripcionesError.value = extractError(error);
  } finally {
    inscripcionesSubmitting.value = false;
  }
}

async function onCerrarInscripciones(): Promise<void> {
  inscripcionesError.value = null;
  inscripcionesSubmitting.value = true;
  try {
    await torneos.cerrarInscripciones(torneoId);
  } catch (error) {
    inscripcionesError.value = extractError(error);
  } finally {
    inscripcionesSubmitting.value = false;
  }
}

// --- HU07: registrar jugador ---

const jugadorQuery = ref("");
const resultadosBusqueda = ref<JugadorBusqueda[]>([]);
const buscando = ref(false);
const inscribirSubmitting = ref(false);
const inscribirError = ref<string | null>(null);

const inscripcionesAbiertas = computed(() => torneos.actual?.estado === "INSCRIPCIONES_ABIERTAS");
const yaInscritoIds = computed(() => new Set(torneos.jugadoresInscritos.map((j) => j.jugadorId)));

let debounceHandle: ReturnType<typeof setTimeout> | undefined;

// Búsqueda con debounce: evita un request por cada tecla mientras el
// organizador escribe nombre, correo o código universitario.
watch(jugadorQuery, (query) => {
  clearTimeout(debounceHandle);
  if (!query.trim()) {
    resultadosBusqueda.value = [];
    return;
  }
  debounceHandle = setTimeout(async () => {
    buscando.value = true;
    try {
      resultadosBusqueda.value = await buscarJugadores(query.trim());
    } catch {
      resultadosBusqueda.value = [];
    } finally {
      buscando.value = false;
    }
  }, 300);
});

async function onInscribirJugador(jugador: JugadorBusqueda): Promise<void> {
  inscribirError.value = null;
  inscribirSubmitting.value = true;
  try {
    await torneos.inscribirJugador(torneoId, jugador.id);
    jugadorQuery.value = "";
    resultadosBusqueda.value = [];
  } catch (error) {
    inscribirError.value = extractError(error);
  } finally {
    inscribirSubmitting.value = false;
  }
}

function extractError(error: unknown): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
    return error.response.data.error;
  }
  return "No se pudo conectar con el servidor";
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="container admin">
      <p v-if="loading">Cargando torneo…</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <template v-else-if="torneos.actual">
        <header class="admin-header">
          <h1>{{ torneos.actual.nombre }}</h1>
          <span class="estado-pill">{{ ESTADO_LABELS[torneos.actual.estado] ?? torneos.actual.estado }}</span>
        </header>

        <!-- HU05 -->
        <section class="admin-card">
          <h2>Configuración del torneo</h2>
          <p class="section-hint">Rondas, ritmo y orden de desempates.</p>

          <Transition name="banner">
            <p v-if="configError" role="alert" class="banner banner--error">{{ configError }}</p>
          </Transition>
          <Transition name="banner">
            <p v-if="configSuccess" class="banner banner--success">{{ configSuccess }}</p>
          </Transition>

          <form novalidate class="config-form" @submit.prevent="onConfigurar">
            <div class="field-row">
              <div class="field">
                <label for="numeroRondas">Número de rondas</label>
                <input id="numeroRondas" v-model="configForm.numeroRondas" type="number" min="1" placeholder="7" />
              </div>
              <div class="field">
                <label for="ritmo">Ritmo</label>
                <input id="ritmo" v-model="configForm.ritmo" type="text" placeholder="90+30" />
              </div>
            </div>

            <div class="field">
              <label for="desempates">Orden de desempates (separados por coma)</label>
              <input
                id="desempates"
                v-model="configForm.desempates"
                type="text"
                :disabled="!puedeEditarDesempates"
              />
              <span v-if="!puedeEditarDesempates" class="section-hint">
                No se puede modificar: ya inició la primera ronda.
              </span>
            </div>

            <button type="submit" class="btn btn-primary" :disabled="configSubmitting">
              {{ configSubmitting ? "Guardando..." : "Guardar configuración" }}
            </button>
          </form>
        </section>

        <!-- HU06 -->
        <section class="admin-card">
          <h2>Inscripciones</h2>
          <p class="section-hint">
            Controlá cuándo se aceptan nuevos participantes. Estado actual:
            <strong>{{ ESTADO_LABELS[torneos.actual.estado] ?? torneos.actual.estado }}</strong>
          </p>

          <Transition name="banner">
            <p v-if="inscripcionesError" role="alert" class="banner banner--error">{{ inscripcionesError }}</p>
          </Transition>

          <div class="inline-actions">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="inscripcionesSubmitting || torneos.actual.estado !== 'CREADO'"
              @click="onAbrirInscripciones"
            >
              Abrir inscripciones
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="inscripcionesSubmitting || torneos.actual.estado !== 'INSCRIPCIONES_ABIERTAS'"
              @click="onCerrarInscripciones"
            >
              Cerrar inscripciones
            </button>
          </div>
        </section>

        <!-- HU07 -->
        <section class="admin-card">
          <h2>Jugadores inscritos</h2>
          <p class="section-hint">Listado oficial de participantes del torneo.</p>

          <Transition name="banner">
            <p v-if="inscribirError" role="alert" class="banner banner--error">{{ inscribirError }}</p>
          </Transition>

          <div class="field jugador-search">
            <label for="jugadorQuery">Buscar jugador (nombre, correo o código)</label>
            <input
              id="jugadorQuery"
              v-model="jugadorQuery"
              type="text"
              placeholder="Luis Gómez"
              :disabled="!inscripcionesAbiertas"
            />

            <ul v-if="jugadorQuery.trim() && inscripcionesAbiertas" class="search-results">
              <li v-if="buscando" class="search-hint">Buscando…</li>
              <template v-else-if="resultadosBusqueda.length > 0">
                <li v-for="jugador in resultadosBusqueda" :key="jugador.id" class="search-result">
                  <div>
                    <strong>{{ jugador.nombre }}</strong>
                    <span class="section-hint">{{ jugador.codigoUniversitario }} · {{ jugador.programa }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="inscribirSubmitting || yaInscritoIds.has(jugador.id)"
                    @click="onInscribirJugador(jugador)"
                  >
                    {{ yaInscritoIds.has(jugador.id) ? "Ya inscrito" : "Inscribir" }}
                  </button>
                </li>
              </template>
              <li v-else class="search-hint">Sin resultados</li>
            </ul>
          </div>
          <p v-if="!inscripcionesAbiertas" class="section-hint">
            Las inscripciones deben estar abiertas para registrar jugadores.
          </p>

          <table v-if="torneos.jugadoresInscritos.length > 0" class="jugadores-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Programa</th>
                <th>Semestre</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="jugador in torneos.jugadoresInscritos" :key="jugador.jugadorId">
                <td>{{ jugador.nombre }}</td>
                <td>{{ jugador.codigoUniversitario }}</td>
                <td>{{ jugador.programa }}</td>
                <td>{{ jugador.semestre }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="section-hint">Todavía no hay jugadores inscritos.</p>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.admin {
  padding-block: 3rem;
  max-width: 40rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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

.admin-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.75rem;
}

.admin-card h2 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
}

.section-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0 0 1rem;
}

.config-form,
.inline-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inline-form {
  flex-direction: row;
  align-items: flex-end;
  gap: 0.75rem;
}

.inline-form .field {
  flex: 1;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.jugador-search {
  position: relative;
}

.search-results {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.search-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--border-soft);
}

.search-result:last-child {
  border-bottom: none;
}

.search-result div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.search-hint {
  padding: 0.6rem 0.85rem;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.inline-actions {
  display: flex;
  gap: 0.75rem;
}

.jugadores-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.jugadores-table th,
.jugadores-table td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border-soft);
  font-size: 0.9rem;
}
</style>
