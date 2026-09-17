<script setup lang="ts">
import axios from "axios";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import { useTorneosStore } from "../stores/torneos";

const router = useRouter();
const torneos = useTorneosStore();

const form = reactive({
  nombre: "",
  fechaInicio: "",
  fechaFin: "",
  formato: "suizo",
});

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const serverError = ref<string | null>(null);

// Reglas espejo de backend/src/validators/torneos.schemas.ts.
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.nombre.trim().length < 2) {
    errors.nombre = "El nombre debe tener al menos 2 caracteres";
  }
  if (!form.fechaInicio) {
    errors.fechaInicio = "La fecha de inicio es requerida";
  }
  if (!form.fechaFin) {
    errors.fechaFin = "La fecha de fin es requerida";
  }
  if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
    errors.fechaFin = "La fecha de fin no puede ser anterior a la fecha de inicio";
  }

  return Object.keys(errors).length === 0;
}

async function onSubmit(): Promise<void> {
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    const torneo = await torneos.crear({
      nombre: form.nombre.trim(),
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      formato: form.formato.trim() || undefined,
    });
    router.push(`/torneos/${torneo.id}`);
  } catch (error) {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
      serverError.value = error.response.data.error;
    } else {
      serverError.value = "No se pudo conectar con el servidor";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="container create-tournament">
      <h1>Crear torneo</h1>
      <p class="subtitle">Datos básicos para iniciar la administración del torneo.</p>

      <Transition name="banner">
        <p v-if="serverError" role="alert" class="banner banner--error">{{ serverError }}</p>
      </Transition>

      <form novalidate class="tournament-form" @submit.prevent="onSubmit">
        <div class="field" :class="{ 'has-error': errors.nombre }">
          <label for="nombre">Nombre del torneo</label>
          <input id="nombre" v-model="form.nombre" type="text" placeholder="Copa Universitaria de Ajedrez" />
          <span class="field-error">{{ errors.nombre }}</span>
        </div>

        <div class="field-row">
          <div class="field" :class="{ 'has-error': errors.fechaInicio }">
            <label for="fechaInicio">Fecha de inicio</label>
            <input id="fechaInicio" v-model="form.fechaInicio" type="date" />
            <span class="field-error">{{ errors.fechaInicio }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.fechaFin }">
            <label for="fechaFin">Fecha de fin</label>
            <input id="fechaFin" v-model="form.fechaFin" type="date" />
            <span class="field-error">{{ errors.fechaFin }}</span>
          </div>
        </div>

        <div class="field">
          <label for="formato">Formato</label>
          <input id="formato" v-model="form.formato" type="text" placeholder="suizo" />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
          {{ submitting ? "Creando torneo..." : "Crear torneo" }}
        </button>
      </form>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.create-tournament {
  padding-block: 3rem;
  max-width: 32rem;
}

.subtitle {
  color: var(--text-muted);
  margin-top: 0.25rem;
}

.tournament-form {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>
