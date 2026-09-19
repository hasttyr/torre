<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import { buscarJugadores, type JugadorBusqueda } from "../services/jugadores";
import { useTorneosStore } from "../stores/torneos";

const route = useRoute();
const torneos = useTorneosStore();
const torneoId = String(route.params.id);
const { t } = useI18n();

const loadError = ref<string | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    await torneos.cargar(torneoId);
    poblarConfigForm();
  } catch {
    loadError.value = t("tournamentAdmin.loadError");
  } finally {
    loading.value = false;
  }
});

// --- HU05: configurar torneo (rondas, ritmo, desempates) ---

const configForm = reactive({
  numeroRondas: "",
  ritmo: "",
  desempates: "Buchholz, Buchholz Cortado 1, Sonneborn-Berger, ARO",
  programaRestringido: "",
  semestreMinimo: "",
});
const configSubmitting = ref(false);
const configError = ref<string | null>(null);
const configSuccess = ref<string | null>(null);

// Refleja el estado guardado en vez de arrancar siempre en blanco: si el
// organizador vuelve a un torneo ya configurado, ve lo que hay.
function poblarConfigForm(): void {
  if (!torneos.actual) return;
  configForm.numeroRondas = torneos.actual.numeroRondas != null ? String(torneos.actual.numeroRondas) : "";
  configForm.ritmo = torneos.actual.ritmo ?? "";
  if (torneos.actual.criteriosDesempate.length > 0) {
    configForm.desempates = torneos.actual.criteriosDesempate.map((c) => c.nombre).join(", ");
  }
  configForm.programaRestringido = torneos.actual.programaRestringido ?? "";
  configForm.semestreMinimo = torneos.actual.semestreMinimo != null ? String(torneos.actual.semestreMinimo) : "";
}

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
      programaRestringido: configForm.programaRestringido.trim() || null,
      semestreMinimo: configForm.semestreMinimo ? Number(configForm.semestreMinimo) : null,
    });
    configSuccess.value = t("tournamentAdmin.configSuccess");
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
  return t("tournamentAdmin.genericServerError");
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-xl flex-col gap-6 py-10 sm:py-12">
      <p v-if="loading">{{ t("tournamentAdmin.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <template v-else-if="torneos.actual">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-2xl sm:text-3xl">{{ torneos.actual.nombre }}</h1>
          <span class="pill">{{ t(`estados.${torneos.actual.estado}`) }}</span>
        </header>

        <!-- HU05 -->
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.configTitle") }}</h2>
          <p class="mb-4 text-sm">{{ t("tournamentAdmin.configSubtitle") }}</p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="configError" role="alert" class="banner banner--error mb-4">{{ configError }}</p>
          </Transition>
          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="configSuccess" class="banner banner--success mb-4">{{ configSuccess }}</p>
          </Transition>

          <form novalidate class="config-form flex flex-col gap-4" @submit.prevent="onConfigurar">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field">
                <label for="numeroRondas">{{ t("tournamentAdmin.numeroRondasLabel") }}</label>
                <input id="numeroRondas" v-model="configForm.numeroRondas" type="number" min="1" placeholder="7" />
              </div>
              <div class="field">
                <label for="ritmo">{{ t("tournamentAdmin.ritmoLabel") }}</label>
                <input id="ritmo" v-model="configForm.ritmo" type="text" placeholder="90+30" />
              </div>
            </div>

            <div class="field">
              <label for="desempates">{{ t("tournamentAdmin.desempatesLabel") }}</label>
              <input
                id="desempates"
                v-model="configForm.desempates"
                type="text"
                :disabled="!puedeEditarDesempates"
              />
              <span v-if="!puedeEditarDesempates" class="text-sm text-text-muted">
                {{ t("tournamentAdmin.desempatesLockedHint") }}
              </span>
            </div>

            <div class="border-t border-border-soft pt-4">
              <p class="field-label mb-3">{{ t("tournamentAdmin.eligibilityLegend") }}</p>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="field">
                  <label for="programaRestringido">{{ t("tournamentAdmin.programaRestringidoLabel") }}</label>
                  <input
                    id="programaRestringido"
                    v-model="configForm.programaRestringido"
                    type="text"
                    :placeholder="t('tournamentAdmin.programaRestringidoPlaceholder')"
                  />
                </div>
                <div class="field">
                  <label for="semestreMinimo">{{ t("tournamentAdmin.semestreMinimoLabel") }}</label>
                  <input
                    id="semestreMinimo"
                    v-model="configForm.semestreMinimo"
                    type="number"
                    min="1"
                    :placeholder="t('tournamentAdmin.semestreMinimoPlaceholder')"
                  />
                </div>
              </div>
              <p class="mt-2 text-sm text-text-muted">
                {{ t("tournamentAdmin.eligibilityHint") }}
              </p>
            </div>

            <button type="submit" class="btn btn-primary self-start" :disabled="configSubmitting">
              {{ configSubmitting ? t("tournamentAdmin.saving") : t("tournamentAdmin.saveConfig") }}
            </button>
          </form>
        </section>

        <!-- HU06 -->
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.inscripcionesTitle") }}</h2>
          <p class="mb-4 text-sm">
            {{ t("tournamentAdmin.inscripcionesSubtitle") }}
            <strong class="text-text">{{ t(`estados.${torneos.actual.estado}`) }}</strong>
          </p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="inscripcionesError" role="alert" class="banner banner--error mb-4">{{ inscripcionesError }}</p>
          </Transition>

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="inscripcionesSubmitting || torneos.actual.estado !== 'CREADO'"
              @click="onAbrirInscripciones"
            >
              {{ t("tournamentAdmin.abrirInscripciones") }}
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="inscripcionesSubmitting || torneos.actual.estado !== 'INSCRIPCIONES_ABIERTAS'"
              @click="onCerrarInscripciones"
            >
              {{ t("tournamentAdmin.cerrarInscripciones") }}
            </button>
          </div>
        </section>

        <!-- HU07 -->
        <section class="card">
          <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.jugadoresTitle") }}</h2>
          <p class="mb-4 text-sm">{{ t("tournamentAdmin.jugadoresSubtitle") }}</p>

          <Transition
            enter-active-class="transition duration-180 ease-out"
            enter-from-class="opacity-0 -translate-y-1.5"
            leave-active-class="transition duration-180 ease-in"
            leave-to-class="opacity-0 -translate-y-1.5"
          >
            <p v-if="inscribirError" role="alert" class="banner banner--error mb-4">{{ inscribirError }}</p>
          </Transition>

          <div class="field relative">
            <label for="jugadorQuery">{{ t("tournamentAdmin.buscarLabel") }}</label>
            <input
              id="jugadorQuery"
              v-model="jugadorQuery"
              type="text"
              :placeholder="t('tournamentAdmin.buscarPlaceholder')"
              :disabled="!inscripcionesAbiertas"
            />

            <ul
              v-if="jugadorQuery.trim() && inscripcionesAbiertas"
              class="mt-2 list-none overflow-hidden rounded-lg border border-border-soft p-0"
            >
              <li v-if="buscando" class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("tournamentAdmin.buscando") }}</li>
              <template v-else-if="resultadosBusqueda.length > 0">
                <li
                  v-for="jugador in resultadosBusqueda"
                  :key="jugador.id"
                  class="flex items-center justify-between gap-3 border-b border-border-soft px-3.5 py-2.5 last:border-b-0"
                >
                  <div class="flex flex-col gap-0.5">
                    <strong class="text-text">{{ jugador.nombre }}</strong>
                    <span class="text-sm text-text-muted">{{ jugador.codigoUniversitario }} · {{ jugador.programa }}</span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="inscribirSubmitting || yaInscritoIds.has(jugador.id)"
                    @click="onInscribirJugador(jugador)"
                  >
                    {{ yaInscritoIds.has(jugador.id) ? t("tournamentAdmin.yaInscrito") : t("tournamentAdmin.inscribir") }}
                  </button>
                </li>
              </template>
              <li v-else class="px-3.5 py-2.5 text-sm text-text-muted">{{ t("tournamentAdmin.sinResultados") }}</li>
            </ul>
          </div>
          <p v-if="!inscripcionesAbiertas" class="mb-4 text-sm text-text-muted">
            {{ t("tournamentAdmin.inscripcionesClosedHint") }}
          </p>

          <div v-if="torneos.jugadoresInscritos.length > 0" class="mt-4 -mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <table class="w-full min-w-md border-collapse">
              <thead>
                <tr>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableNombre") }}</th>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableCodigo") }}</th>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tablePrograma") }}</th>
                  <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">{{ t("tournamentAdmin.tableSemestre") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="jugador in torneos.jugadoresInscritos" :key="jugador.jugadorId">
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ jugador.nombre }}</td>
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ jugador.codigoUniversitario }}</td>
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ jugador.programa }}</td>
                  <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ jugador.semestre }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-text-muted">{{ t("tournamentAdmin.sinJugadores") }}</p>
        </section>
      </template>
    </main>
  </div>
</template>
