<script setup lang="ts">
import axios from "axios";
import { onMounted, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../components/AppHeader.vue";
import DateField from "../components/DateField.vue";
import { DISCAPACIDADES, GENEROS, type Discapacidad, type Genero } from "../services/auth";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const { t } = useI18n();
const loadError = ref<string | null>(null);
const hoyIso = new Date().toISOString().slice(0, 10);

// HU20: formulario de edición del propio perfil. Se puebla desde
// auth.usuario apenas llega (onMounted y el watch de abajo, por si
// refreshUsuario resuelve después del primer render).
const form = reactive({
  nombre: "",
  codigoUniversitario: "",
  programa: "",
  semestre: "",
  fechaNacimiento: "",
  genero: "" as Genero | "",
  discapacidad: "" as Discapacidad | "",
});

function poblarForm(): void {
  if (!auth.usuario) return;
  form.nombre = auth.usuario.nombre;
  if (auth.usuario.jugador) {
    form.codigoUniversitario = auth.usuario.jugador.codigoUniversitario;
    form.programa = auth.usuario.jugador.programa;
    form.semestre = String(auth.usuario.jugador.semestre);
    // El input date espera "YYYY-MM-DD"; el backend devuelve ISO completo.
    form.fechaNacimiento = auth.usuario.jugador.fechaNacimiento?.slice(0, 10) ?? "";
    form.genero = auth.usuario.jugador.genero ?? "";
    form.discapacidad = auth.usuario.jugador.discapacidad ?? "";
  }
}

watch(() => auth.usuario, poblarForm, { immediate: true });

onMounted(async () => {
  try {
    await auth.refreshUsuario();
  } catch {
    loadError.value = t("account.loadError");
  }
});

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const successMessage = ref<string | null>(null);
const serverError = ref<string | null>(null);

// Reglas espejo de backend/src/validators/users.schemas.ts.
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.nombre.trim().length < 2) {
    errors.nombre = t("account.nombreMinLength");
  }

  if (auth.usuario?.jugador) {
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
      ...(auth.usuario?.jugador
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

      <section v-if="auth.usuario" class="card mt-6">
        <dl class="m-0">
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">{{ t("account.correo") }}</dt>
            <dd class="m-0 font-semibold">{{ auth.usuario.email }}</dd>
          </div>
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">{{ t("account.rol") }}</dt>
            <dd class="m-0 font-semibold">{{ t(`roles.${auth.usuario.rol}`) }}</dd>
          </div>
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-sm text-text-muted">{{ t("account.estado") }}</dt>
            <dd class="m-0 font-semibold">{{ auth.usuario.estado === "ACTIVO" ? t("account.activa") : t("account.inactiva") }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="auth.usuario" class="card mt-6">
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

          <template v-if="auth.usuario.jugador">
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
                <DateField id="fechaNacimiento" v-model="form.fechaNacimiento" :max-date="hoyIso" />
                <span class="field-error">{{ errors.fechaNacimiento }}</span>
                <span v-if="auth.usuario.jugador.edad != null" class="text-sm text-text-muted">
                  {{ t("account.edadActual", { edad: auth.usuario.jugador.edad }) }}
                </span>
              </div>
              <div class="field">
                <label for="genero">{{ t("account.generoLabel") }}</label>
                <select id="genero" v-model="form.genero">
                  <option value="">{{ t("account.generoPreferNo") }}</option>
                  <option v-for="opcion in GENEROS" :key="opcion" :value="opcion">{{ t(`genero.${opcion}`) }}</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label for="discapacidad">{{ t("account.discapacidadLabel") }}</label>
              <select id="discapacidad" v-model="form.discapacidad">
                <option value="">{{ t("account.discapacidadSinEspecificar") }}</option>
                <option v-for="opcion in DISCAPACIDADES" :key="opcion" :value="opcion">
                  {{ t(`discapacidad.${opcion}`) }}
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
