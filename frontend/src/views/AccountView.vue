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
  <div class="page">
    <AppHeader />

    <main class="container account">
      <h1>Mi cuenta</h1>

      <p v-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <section v-if="auth.usuario" class="account-card">
        <dl>
          <div class="account-row">
            <dt>Nombre</dt>
            <dd>{{ auth.usuario.nombre }}</dd>
          </div>
          <div class="account-row">
            <dt>Correo</dt>
            <dd>{{ auth.usuario.email }}</dd>
          </div>
          <div class="account-row">
            <dt>Rol</dt>
            <dd>{{ ROLE_LABELS[auth.usuario.rol] ?? auth.usuario.rol }}</dd>
          </div>
          <div class="account-row">
            <dt>Estado</dt>
            <dd>{{ auth.usuario.estado === "ACTIVO" ? "Activa" : "Inactiva" }}</dd>
          </div>
        </dl>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.account {
  padding-block: 3rem;
  max-width: 40rem;
}

.account-card {
  margin-top: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.75rem;
}

dl {
  margin: 0;
}

.account-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.75rem;
  border-bottom: 1px solid var(--border-soft);
}

.account-row:last-child {
  border-bottom: none;
}

.account-row dt {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.account-row dd {
  margin: 0;
  font-weight: 600;
}
</style>
