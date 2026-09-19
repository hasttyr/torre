<script setup lang="ts">
import axios from "axios";
import { onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../components/AppHeader.vue";
import DateField from "../components/DateField.vue";
import { DISABILITIES, GENDERS, type Disability, type Gender } from "../services/auth";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const { t } = useI18n();
const loadError = ref<string | null>(null);
const todayIso = new Date().toISOString().slice(0, 10);

// HU20: form for editing the user's own profile. It gets populated from
// auth.user as soon as it arrives (onMounted and the watch below, in case
// refreshUser resolves after the first render).
const form = reactive({
  nombre: "",
  codigoUniversitario: "",
  programa: "",
  semestre: "",
  fechaNacimiento: "",
  genero: "" as Gender | "",
  discapacidad: "" as Disability | "",
});

/** Fills the edit form from the currently loaded user, if any. */
function populateForm(): void {
  if (!auth.user) return;
  form.nombre = auth.user.nombre;
  if (auth.user.jugador) {
    form.codigoUniversitario = auth.user.jugador.codigoUniversitario;
    form.programa = auth.user.jugador.programa;
    form.semestre = String(auth.user.jugador.semestre);
    // The date input expects "YYYY-MM-DD"; the backend returns a full ISO string.
    form.fechaNacimiento = auth.user.jugador.fechaNacimiento?.slice(0, 10) ?? "";
    form.genero = auth.user.jugador.genero ?? "";
    form.discapacidad = auth.user.jugador.discapacidad ?? "";
  }
}

watch(() => auth.user, populateForm, { immediate: true });

onMounted(async () => {
  try {
    await auth.refreshUser();
  } catch {
    loadError.value = t("account.loadError");
  }
});

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const successMessage = ref<string | null>(null);
const serverError = ref<string | null>(null);

/**
 * Validates the profile edit form, mirroring
 * backend/src/validators/users.schemas.ts.
 *
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.nombre.trim().length < 2) {
    errors.nombre = t("account.nombreMinLength");
  }

  if (auth.user?.jugador) {
    if (!form.codigoUniversitario.trim()) {
      errors.codigoUniversitario = t("account.codigoRequired");
    }
    if (!form.programa.trim()) {
      errors.programa = t("account.programaRequired");
    }
    if (!Number.isInteger(Number(form.semestre)) || Number(form.semestre) <= 0) {
      errors.semestre = t("account.semestrePositive");
    }
    if (form.fechaNacimiento && form.fechaNacimiento > new Date().toISOString().slice(0, 10)) {
      errors.fechaNacimiento = t("account.fechaNacimientoFutura");
    }
  }

  return Object.keys(errors).length === 0;
}

/** Validates and submits the profile edit form to the backend. */
async function onSubmit(): Promise<void> {
  successMessage.value = null;
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    await auth.updateProfile({
      nombre: form.nombre.trim(),
      ...(auth.user?.jugador
        ? {
            codigoUniversitario: form.codigoUniversitario.trim(),
            programa: form.programa.trim(),
            semestre: Number(form.semestre),
            fechaNacimiento: form.fechaNacimiento || null,
            genero: form.genero || null,
            discapacidad: form.discapacidad || null,
          }
        : {}),
    });
    successMessage.value = t("account.successMessage");
  } catch (error) {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
      serverError.value = error.response.data.error;
    } else {
      serverError.value = t("account.genericServerError");
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container max-w-xl py-10 sm:py-12">
      <h1 class="text-2xl sm:text-3xl">{{ t("account.title") }}</h1>

      <p v-if="loadError" role="alert" class="banner banner--error mt-4">{{ loadError }}</p>

      <section v-if="auth.user" class="card mt-6">
        <dl class="m-0">
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">{{ t("account.correo") }}</dt>
            <dd class="m-0 font-semibold">{{ auth.user.email }}</dd>
          </div>
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">{{ t("account.rol") }}</dt>
            <dd class="m-0 font-semibold">{{ t(`roles.${auth.user.rol}`) }}</dd>
          </div>
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-sm text-text-muted">{{ t("account.estado") }}</dt>
            <dd class="m-0 font-semibold">{{ auth.user.estado === "ACTIVO" ? t("account.activa") : t("account.inactiva") }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="auth.user" class="card mt-6">
        <h2 class="mb-1 text-lg">{{ t("account.editProfileTitle") }}</h2>
        <p class="mb-4 text-sm">{{ t("account.editProfileHint") }}</p>

        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="successMessage" class="banner banner--success mb-4">{{ successMessage }}</p>
        </Transition>
        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="serverError" role="alert" class="banner banner--error mb-4">{{ serverError }}</p>
        </Transition>

        <form novalidate class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="field" :class="{ 'has-error': errors.nombre }">
            <label for="nombre">{{ t("account.nombreLabel") }}</label>
            <input id="nombre" v-model="form.nombre" type="text" autocomplete="name" />
            <span class="field-error">{{ errors.nombre }}</span>
          </div>

          <template v-if="auth.user.jugador">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field" :class="{ 'has-error': errors.codigoUniversitario }">
                <label for="codigo">{{ t("account.codigoLabel") }}</label>
                <input id="codigo" v-model="form.codigoUniversitario" type="text" />
                <span class="field-error">{{ errors.codigoUniversitario }}</span>
              </div>
              <div class="field" :class="{ 'has-error': errors.semestre }">
                <label for="semestre">{{ t("account.semestreLabel") }}</label>
                <input id="semestre" v-model="form.semestre" type="number" min="1" />
                <span class="field-error">{{ errors.semestre }}</span>
              </div>
            </div>
            <div class="field" :class="{ 'has-error': errors.programa }">
              <label for="programa">{{ t("account.programaLabel") }}</label>
              <input id="programa" v-model="form.programa" type="text" />
              <span class="field-error">{{ errors.programa }}</span>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field" :class="{ 'has-error': errors.fechaNacimiento }">
                <label for="fechaNacimiento">{{ t("account.fechaNacimientoLabel") }}</label>
                <DateField id="fechaNacimiento" v-model="form.fechaNacimiento" :max-date="todayIso" />
                <span class="field-error">{{ errors.fechaNacimiento }}</span>
                <span v-if="auth.user.jugador.edad != null" class="text-sm text-text-muted">
                  {{ t("account.edadActual", { edad: auth.user.jugador.edad }) }}
                </span>
              </div>
              <div class="field">
                <label for="genero">{{ t("account.generoLabel") }}</label>
                <select id="genero" v-model="form.genero">
                  <option value="">{{ t("account.generoPreferNo") }}</option>
                  <option v-for="option in GENDERS" :key="option" :value="option">{{ t(`genero.${option}`) }}</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label for="discapacidad">{{ t("account.discapacidadLabel") }}</label>
              <select id="discapacidad" v-model="form.discapacidad">
                <option value="">{{ t("account.discapacidadSinEspecificar") }}</option>
                <option v-for="option in DISABILITIES" :key="option" :value="option">
                  {{ t(`discapacidad.${option}`) }}
                </option>
              </select>
            </div>
          </template>

          <button type="submit" class="btn btn-primary self-start" :disabled="submitting">
            {{ submitting ? t("account.saving") : t("account.saveButton") }}
          </button>
        </form>
      </section>
    </main>
  </div>
</template>
