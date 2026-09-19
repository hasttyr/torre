<script setup lang="ts">
import axios from "axios";
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import AppHeader from "../components/AppHeader.vue";
import DateField from "../components/DateField.vue";
import { useTournamentsStore } from "../stores/tournaments";

const router = useRouter();
const tournaments = useTournamentsStore();
const { t } = useI18n();

const form = reactive({
  nombre: "",
  fechaInicio: "",
  fechaFin: "",
  formato: "suizo",
});

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const serverError = ref<string | null>(null);

/**
 * Validates the tournament creation form, mirroring
 * backend/src/validators/torneos.schemas.ts.
 *
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.nombre.trim().length < 2) {
    errors.nombre = t("createTournament.nombreMinLength");
  }
  if (!form.fechaInicio) {
    errors.fechaInicio = t("createTournament.fechaInicioRequired");
  }
  if (!form.fechaFin) {
    errors.fechaFin = t("createTournament.fechaFinRequired");
  }
  if (form.fechaInicio && form.fechaFin && form.fechaFin < form.fechaInicio) {
    errors.fechaFin = t("createTournament.fechaFinAnterior");
  }

  return Object.keys(errors).length === 0;
}

/** Validates and submits the tournament creation form to the backend. */
async function onSubmit(): Promise<void> {
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    const tournament = await tournaments.create({
      nombre: form.nombre.trim(),
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      formato: form.formato.trim() || undefined,
    });
    router.push(`/torneos/${tournament.id}`);
  } catch (error) {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
      serverError.value = error.response.data.error;
    } else {
      serverError.value = t("auth.serverError");
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
      <h1 class="text-2xl sm:text-3xl">{{ t("createTournament.title") }}</h1>
      <p class="mt-1">{{ t("createTournament.subtitle") }}</p>

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
          <label for="nombre">{{ t("createTournament.nombreLabel") }}</label>
          <input id="nombre" v-model="form.nombre" type="text" :placeholder="t('createTournament.nombrePlaceholder')" />
          <span class="field-error">{{ errors.nombre }}</span>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="field" :class="{ 'has-error': errors.fechaInicio }">
            <label for="fechaInicio">{{ t("createTournament.fechaInicioLabel") }}</label>
            <DateField id="fechaInicio" v-model="form.fechaInicio" />
            <span class="field-error">{{ errors.fechaInicio }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.fechaFin }">
            <label for="fechaFin">{{ t("createTournament.fechaFinLabel") }}</label>
            <DateField id="fechaFin" v-model="form.fechaFin" />
            <span class="field-error">{{ errors.fechaFin }}</span>
          </div>
        </div>

        <div class="field">
          <label for="formato">{{ t("createTournament.formatoLabel") }}</label>
          <input id="formato" v-model="form.formato" type="text" :placeholder="t('createTournament.formatoPlaceholder')" />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
          {{ submitting ? t("createTournament.submitting") : t("createTournament.submit") }}
        </button>
      </form>
    </main>
  </div>
</template>
