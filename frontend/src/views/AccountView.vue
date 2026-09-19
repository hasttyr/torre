<script setup lang="ts">
import { onMounted, ref } from "vue";

import AppHeader from "../components/AppHeader.vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    await auth.refreshUsuario();
  } catch {
    loadError.value = "No se pudo actualizar tu perfil. Mostrando los últimos datos guardados.";
  }
});

const ROLE_LABELS: Record<string, string> = {
  JUGADOR: "Jugador",
  ENTRENADOR: "Entrenador",
  ARBITRO: "Árbitro",
  ORGANIZADOR: "Organizador",
  ADMINISTRADOR: "Administrador",
};
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
            <dt class="text-sm text-text-muted">Nombre</dt>
            <dd class="m-0 font-semibold">{{ auth.usuario.nombre }}</dd>
          </div>
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
    </main>
  </div>
</template>
