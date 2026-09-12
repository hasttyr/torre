<script setup lang="ts">
import axios from "axios";
import { computed, reactive, ref } from "vue";

import AppLogo from "../components/AppLogo.vue";
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
  <div class="auth-page">
    <header class="auth-header">
      <div class="container">
        <AppLogo />
      </div>
    </header>

    <main class="auth-main">
      <div class="container auth-layout">
        <aside class="auth-aside" aria-hidden="true">
          <span class="auth-aside__glyph">♞</span>
          <blockquote class="auth-aside__quote">
            “El ajedrez no perdona ni la más pequeña falla.”
            <cite>José Raúl Capablanca</cite>
          </blockquote>
        </aside>

        <section class="auth-card">
          <h1>Crear cuenta</h1>
          <p class="auth-card__subtitle">Elegí tu rol en el torneo para empezar.</p>

          <Transition name="banner">
            <output v-if="successMessage" class="banner banner--success">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" />
                <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ successMessage }}</span>
            </output>
          </Transition>

          <Transition name="banner">
            <p v-if="serverError" role="alert" class="banner banner--error">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M10 2 1 17h18L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
                <path d="M10 8v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                <circle cx="10" cy="14" r="0.9" fill="currentColor" />
              </svg>
              <span>{{ serverError }}</span>
            </p>
          </Transition>

          <form novalidate @submit.prevent="onSubmit">
            <div class="field">
              <span class="field-label">Rol</span>
              <div class="role-picker" role="radiogroup" aria-label="Rol">
                <label
                  v-for="rol in ROLES_AUTOASIGNABLES"
                  :key="rol"
                  class="role-pill"
                  :class="{ 'role-pill--active': form.rol === rol }"
                >
                  <input v-model="form.rol" type="radio" name="rol" :value="rol" class="visually-hidden" />
                  <span class="role-pill__glyph" aria-hidden="true">{{ ROLE_GLYPHS[rol] }}</span>
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

            <Transition name="fields">
              <fieldset v-if="isJugador" class="jugador-fields">
                <legend>Datos de jugador</legend>

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
              <svg v-if="submitting" class="spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              </svg>
              {{ submitting ? "Creando cuenta..." : "Crear cuenta" }}
            </button>
          </form>

          <p class="auth-card__footer"><RouterLink to="/">← Volver al inicio</RouterLink></p>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.auth-header {
  padding-block: 1.5rem;
}

.auth-main {
  flex: 1;
  display: flex;
  align-items: center;
  padding-block: 1rem 3rem;
}

.auth-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: center;
}

@media (min-width: 860px) {
  .auth-layout {
    grid-template-columns: 1fr 1.1fr;
    gap: 3rem;
  }
}

.auth-aside {
  display: none;
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  background: linear-gradient(155deg, var(--surface) 0%, var(--bg-elevated) 100%);
  border: 1px solid var(--border-soft);
  min-height: 26rem;
  flex-direction: column;
  justify-content: space-between;
}

@media (min-width: 860px) {
  .auth-aside {
    display: flex;
  }
}

.auth-aside__glyph {
  font-size: 6rem;
  color: var(--accent);
  opacity: 0.85;
  line-height: 1;
}

.auth-aside__quote {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  line-height: 1.4;
  color: var(--text);
}

.auth-aside__quote cite {
  display: block;
  margin-top: 1rem;
  font-family: var(--font-sans);
  font-style: normal;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.auth-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: clamp(1.75rem, 4vw, 2.5rem);
  box-shadow: var(--shadow-lg);
}

.auth-card h1 {
  font-size: 1.7rem;
}

.auth-card__subtitle {
  margin: 0.35rem 0 1.5rem;
}

.auth-card form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.auth-card__footer {
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.88rem;
}

.auth-card__footer a {
  color: var(--text-muted);
  text-decoration: none;
}

.auth-card__footer a:hover {
  color: var(--accent);
}

.role-picker {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

@media (min-width: 420px) {
  .role-picker {
    grid-template-columns: repeat(4, 1fr);
  }
}

.role-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.7rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted);
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

.role-pill:hover {
  border-color: var(--accent-border);
}

.role-pill--active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}

.role-pill__glyph {
  font-size: 1.3rem;
  color: var(--accent);
}

.jugador-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 1.1rem 1rem 1.25rem;
  margin: 0;
}

.jugador-fields legend {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 0 0.35rem;
}

.banner svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.banner-enter-active,
.banner-leave-active,
.fields-enter-active,
.fields-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.fields-enter-from,
.fields-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
