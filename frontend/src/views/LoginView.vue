<script setup lang="ts">
import axios from "axios";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import AuthLayout from "../components/AuthLayout.vue";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const form = reactive({ email: "", password: "" });
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const serverError = ref<string | null>(null);

function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (!form.email.trim()) {
    errors.email = "El correo es requerido";
  }
  if (!form.password) {
    errors.password = "La contraseña es requerida";
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
    await auth.login(form.email.trim(), form.password);
    router.push("/cuenta");
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
  <AuthLayout
    title="Iniciar sesión"
    subtitle="Accedé con tu correo y contraseña."
    quote="En el ajedrez, como en la vida, una posibilidad olvidada es una posibilidad perdida."
    quote-author="Alexander Kotov"
  >
    <template #banners>
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
      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">Correo</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" placeholder="vos@correo.com" />
        <span class="field-error">{{ errors.email }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.password }">
        <label for="password">Contraseña</label>
        <input id="password" v-model="form.password" type="password" autocomplete="current-password" placeholder="Tu contraseña" />
        <span class="field-error">{{ errors.password }}</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        <svg v-if="submitting" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        {{ submitting ? "Ingresando..." : "Ingresar" }}
      </button>
    </form>

    <template #footer>
      ¿No tenés cuenta? <RouterLink to="/registro">Creá una</RouterLink>
    </template>
  </AuthLayout>
</template>
