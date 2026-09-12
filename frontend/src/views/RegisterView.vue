<script setup lang="ts">
import axios from "axios";
import { computed, reactive, ref } from "vue";

import { registerUser, ROLES_AUTOASIGNABLES, type RegisterPayload, type RolAutoasignable } from "../services/auth";

const ROLE_LABELS: Record<RolAutoasignable, string> = {
  JUGADOR: "Jugador",
  ENTRENADOR: "Entrenador",
  ARBITRO: "Árbitro",
  ORGANIZADOR: "Organizador",
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
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
  <main class="register">
    <h1>Crear cuenta</h1>

    <p v-if="successMessage" role="status" class="banner banner--success">{{ successMessage }}</p>
    <p v-if="serverError" role="alert" class="banner banner--error">{{ serverError }}</p>

    <form novalidate @submit.prevent="onSubmit">
      <label>
        Nombre
        <input v-model="form.nombre" type="text" autocomplete="name" />
        <span v-if="errors.nombre" class="field-error">{{ errors.nombre }}</span>
      </label>

      <label>
        Correo
        <input v-model="form.email" type="email" autocomplete="email" />
        <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
      </label>

      <label>
        Contraseña
        <input v-model="form.password" type="password" autocomplete="new-password" />
        <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
      </label>

      <label>
        Rol
        <select v-model="form.rol">
          <option v-for="rol in ROLES_AUTOASIGNABLES" :key="rol" :value="rol">
            {{ ROLE_LABELS[rol] }}
          </option>
        </select>
      </label>

      <fieldset v-if="isJugador">
        <legend>Datos de jugador</legend>

        <label>
          Código universitario
          <input v-model="form.codigoUniversitario" type="text" />
          <span v-if="errors.codigoUniversitario" class="field-error">{{ errors.codigoUniversitario }}</span>
        </label>

        <label>
          Programa
          <input v-model="form.programa" type="text" />
          <span v-if="errors.programa" class="field-error">{{ errors.programa }}</span>
        </label>

        <label>
          Semestre
          <input v-model="form.semestre" type="number" min="1" />
          <span v-if="errors.semestre" class="field-error">{{ errors.semestre }}</span>
        </label>
      </fieldset>

      <button type="submit" :disabled="submitting">
        {{ submitting ? "Creando cuenta..." : "Crear cuenta" }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.register {
  max-width: 28rem;
  margin: 2rem auto;
  padding: 0 1rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

fieldset {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 0.5rem;
}

.field-error {
  color: #b00020;
  font-size: 0.85rem;
}

.banner {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
}

.banner--success {
  background: #e6f4ea;
  color: #1e4620;
}

.banner--error {
  background: #fdecea;
  color: #611a15;
}
</style>
