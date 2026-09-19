<script setup lang="ts">
import axios from "axios";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import DateField from "../components/DateField.vue";
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
  <div class="min-h-screen">
    <AppHeader />

    <main class="container max-w-lg py-10 sm:py-12">
      <h1 class="text-2xl sm:text-3xl">Crear torneo</h1>
      <p class="mt-1">Datos básicos para iniciar la administración del torneo.</p>

      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <p v-if="serverError" role="alert" class="banner banner--error mt-4">{{ serverError }}</p>
      </Transition>

      <form novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="field" :class="{ 'has-error': errors.nombre }">
          <label for="nombre">Nombre del torneo</label>
          <input id="nombre" v-model="form.nombre" type="text" placeholder="Copa Universitaria de Ajedrez" />
          <span class="field-error">{{ errors.nombre }}</span>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="field" :class="{ 'has-error': errors.fechaInicio }">
            <label for="fechaInicio">Fecha de inicio</label>
            <DateField id="fechaInicio" v-model="form.fechaInicio" />
            <span class="field-error">{{ errors.fechaInicio }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.fechaFin }">
            <label for="fechaFin">Fecha de fin</label>
            <DateField id="fechaFin" v-model="form.fechaFin" />
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
