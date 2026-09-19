<script setup lang="ts">
import axios from "axios";
import { computed, reactive, ref } from "vue";

import AuthLayout from "../components/AuthLayout.vue";
import { registerUser, ROLES_AUTOASIGNABLES, type RegisterPayload, type RolAutoasignable } from "../services/auth";

const ROLE_LABELS: Record<RolAutoasignable, string> = {
  JUGADOR: "Jugador",
  ENTRENADOR: "Entrenador",
  ARBITRO: "Árbitro",
  ORGANIZADOR: "Organizador",
};

const ROLE_GLYPHS: Record<RolAutoasignable, string> = {
  JUGADOR: "♙",
  ENTRENADOR: "♗",
  ARBITRO: "♘",
  ORGANIZADOR: "♕",
};

const form = reactive({
  nombre: "",
  email: "",
  password: "",
  rol: "JUGADOR" as RolAutoasignable,
  codigoUniversitario: "",
  programa: "",
  semestre: "",
});

const isJugador = computed(() => form.rol === "JUGADOR");

// Chequeo simple de forma (no regex: evita el patrón de backtracking que
// marcan los linters de seguridad). La validación real es la del backend.
function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) {
    return false;
  }
  const domain = value.slice(at + 1);
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1 && !domain.includes(" ");
}

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const successMessage = ref<string | null>(null);
const serverError = ref<string | null>(null);

// Reglas espejo de backend/src/validators/auth.schemas.ts. Es validación de
// UX (feedback inmediato); la validación que manda siempre es la del backend.
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.nombre.trim().length < 2) {
    errors.nombre = "El nombre debe tener al menos 2 caracteres";
  }
  if (!looksLikeEmail(form.email.trim())) {
    errors.email = "El correo no es válido";
  }
  if (form.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres";
  }

  if (isJugador.value) {
    if (!form.codigoUniversitario.trim()) {
      errors.codigoUniversitario = "El código universitario es requerido";
    }
    if (!form.programa.trim()) {
      errors.programa = "El programa es requerido";
    }
    if (!Number.isInteger(Number(form.semestre)) || Number(form.semestre) <= 0) {
      errors.semestre = "El semestre debe ser un entero positivo";
    }
  }

  return Object.keys(errors).length === 0;
}

function buildPayload(): RegisterPayload {
  const base = {
    nombre: form.nombre.trim(),
    email: form.email.trim(),
    password: form.password,
  };

  if (form.rol === "JUGADOR") {
    return {
      ...base,
      rol: "JUGADOR",
      codigoUniversitario: form.codigoUniversitario.trim(),
      programa: form.programa.trim(),
      semestre: Number(form.semestre),
    };
  }

  return { ...base, rol: form.rol };
}

function resetForm(): void {
  form.nombre = "";
  form.email = "";
  form.password = "";
  form.codigoUniversitario = "";
  form.programa = "";
  form.semestre = "";
}

async function onSubmit(): Promise<void> {
  successMessage.value = null;
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    const usuario = await registerUser(buildPayload());
    successMessage.value = `Cuenta creada para ${usuario.email}. Ya podés iniciar sesión.`;
    resetForm();
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
  <AuthLayout title="Crear cuenta" subtitle="Elegí tu rol en el torneo para empezar.">
    <template #banners>
      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <output v-if="successMessage" class="banner banner--success">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" class="mt-0.5 shrink-0">
            <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" />
            <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ successMessage }}</span>
        </output>
      </Transition>

      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <p v-if="serverError" role="alert" class="banner banner--error">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" class="mt-0.5 shrink-0">
            <path d="M10 2 1 17h18L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
            <path d="M10 8v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <circle cx="10" cy="14" r="0.9" fill="currentColor" />
          </svg>
          <span>{{ serverError }}</span>
        </p>
      </Transition>
    </template>

    <form novalidate @submit.prevent="onSubmit">
      <div class="field">
        <span class="field-label">Rol</span>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Rol">
          <label
            v-for="rol in ROLES_AUTOASIGNABLES"
            :key="rol"
            class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center text-[0.78rem] font-semibold transition-colors"
            :class="
              form.rol === rol
                ? 'border-accent bg-accent/15 text-text'
                : 'border-border bg-surface-2 text-text-muted hover:border-accent/40'
            "
          >
            <input v-model="form.rol" type="radio" name="rol" :value="rol" class="sr-only" />
            <span class="text-xl text-accent" aria-hidden="true">{{ ROLE_GLYPHS[rol] }}</span>
            <span>{{ ROLE_LABELS[rol] }}</span>
          </label>
        </div>
      </div>

      <div class="field" :class="{ 'has-error': errors.nombre }">
        <label for="nombre">Nombre</label>
        <input id="nombre" v-model="form.nombre" type="text" autocomplete="name" placeholder="Ana Torres" />
        <span class="field-error">{{ errors.nombre }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">Correo</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" placeholder="vos@correo.com" />
        <span class="field-error">{{ errors.email }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.password }">
        <label for="password">Contraseña</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />
        <span class="field-error">{{ errors.password }}</span>
      </div>

      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <fieldset v-if="isJugador" class="m-0 flex flex-col gap-4 rounded-xl border border-dashed border-border p-4 pt-4">
          <legend class="px-1.5 text-[0.8rem] font-semibold text-text-muted">Datos de jugador</legend>

          <div class="field" :class="{ 'has-error': errors.codigoUniversitario }">
            <label for="codigo">Código universitario</label>
            <input id="codigo" v-model="form.codigoUniversitario" type="text" placeholder="U12345" />
            <span class="field-error">{{ errors.codigoUniversitario }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.programa }">
            <label for="programa">Programa</label>
            <input id="programa" v-model="form.programa" type="text" placeholder="Ingeniería de Sistemas" />
            <span class="field-error">{{ errors.programa }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.semestre }">
            <label for="semestre">Semestre</label>
            <input id="semestre" v-model="form.semestre" type="number" min="1" placeholder="5" />
            <span class="field-error">{{ errors.semestre }}</span>
          </div>
        </fieldset>
      </Transition>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        <svg v-if="submitting" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        {{ submitting ? "Creando cuenta..." : "Crear cuenta" }}
      </button>
    </form>

    <template #footer><RouterLink to="/">← Volver al inicio</RouterLink></template>
  </AuthLayout>
</template>
