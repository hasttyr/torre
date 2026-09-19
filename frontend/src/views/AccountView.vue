<script setup lang="ts">
import axios from "axios";
import { onMounted, reactive, ref, watch } from "vue";

import AppHeader from "../components/AppHeader.vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const loadError = ref<string | null>(null);

const ROLE_LABELS: Record<string, string> = {
  JUGADOR: "Jugador",
  ENTRENADOR: "Entrenador",
  ARBITRO: "Árbitro",
  ORGANIZADOR: "Organizador",
  ADMINISTRADOR: "Administrador",
};

// HU20: formulario de edición del propio perfil. Se puebla desde
// auth.usuario apenas llega (onMounted y el watch de abajo, por si
// refreshUsuario resuelve después del primer render).
const form = reactive({
  nombre: "",
  codigoUniversitario: "",
  programa: "",
  semestre: "",
});

function poblarForm(): void {
  if (!auth.usuario) return;
  form.nombre = auth.usuario.nombre;
  if (auth.usuario.jugador) {
    form.codigoUniversitario = auth.usuario.jugador.codigoUniversitario;
    form.programa = auth.usuario.jugador.programa;
    form.semestre = String(auth.usuario.jugador.semestre);
  }
}

watch(() => auth.usuario, poblarForm, { immediate: true });

onMounted(async () => {
  try {
    await auth.refreshUsuario();
  } catch {
    loadError.value = "No se pudo actualizar tu perfil. Mostrando los últimos datos guardados.";
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
    errors.nombre = "El nombre debe tener al menos 2 caracteres";
  }

  if (auth.usuario?.jugador) {
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
          }
        : {}),
    });
    successMessage.value = "Perfil actualizado";
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

    <main class="container max-w-xl py-10 sm:py-12">
      <h1 class="text-2xl sm:text-3xl">Mi cuenta</h1>

      <p v-if="loadError" role="alert" class="banner banner--error mt-4">{{ loadError }}</p>

      <section v-if="auth.usuario" class="card mt-6">
        <dl class="m-0">
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">Correo</dt>
            <dd class="m-0 font-semibold">{{ auth.usuario.email }}</dd>
          </div>
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">Rol</dt>
            <dd class="m-0 font-semibold">{{ ROLE_LABELS[auth.usuario.rol] ?? auth.usuario.rol }}</dd>
          </div>
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-sm text-text-muted">Estado</dt>
            <dd class="m-0 font-semibold">{{ auth.usuario.estado === "ACTIVO" ? "Activa" : "Inactiva" }}</dd>
          </div>
        </dl>
      </section>

      <section v-if="auth.usuario" class="card mt-6">
        <h2 class="mb-1 text-lg">Editar perfil</h2>
        <p class="mb-4 text-sm">Estos son los únicos datos que podés modificar vos mismo.</p>

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
            <label for="nombre">Nombre</label>
            <input id="nombre" v-model="form.nombre" type="text" autocomplete="name" />
            <span class="field-error">{{ errors.nombre }}</span>
          </div>

          <template v-if="auth.usuario.jugador">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field" :class="{ 'has-error': errors.codigoUniversitario }">
                <label for="codigo">Código universitario</label>
                <input id="codigo" v-model="form.codigoUniversitario" type="text" />
                <span class="field-error">{{ errors.codigoUniversitario }}</span>
              </div>
              <div class="field" :class="{ 'has-error': errors.semestre }">
                <label for="semestre">Semestre</label>
                <input id="semestre" v-model="form.semestre" type="number" min="1" />
                <span class="field-error">{{ errors.semestre }}</span>
              </div>
            </div>
            <div class="field" :class="{ 'has-error': errors.programa }">
              <label for="programa">Programa</label>
              <input id="programa" v-model="form.programa" type="text" />
              <span class="field-error">{{ errors.programa }}</span>
            </div>
          </template>

          <button type="submit" class="btn btn-primary self-start" :disabled="submitting">
            {{ submitting ? "Guardando..." : "Guardar cambios" }}
          </button>
        </form>
      </section>
    </main>
  </div>
</template>
