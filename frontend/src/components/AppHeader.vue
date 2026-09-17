<script setup lang="ts">
import { useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AppLogo from "./AppLogo.vue";

const auth = useAuthStore();
const router = useRouter();

async function onLogout(): Promise<void> {
  await auth.logout();
  router.push("/");
}
</script>

<template>
  <header class="app-header">
    <div class="container app-header__inner">
      <AppLogo />
      <nav class="app-header__nav">
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/cuenta" class="btn btn-ghost">Mi cuenta</RouterLink>
          <button type="button" class="btn btn-ghost" @click="onLogout">Cerrar sesión</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost">Iniciar sesión</RouterLink>
          <RouterLink to="/registro" class="btn btn-primary">Crear cuenta</RouterLink>
        </template>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
  background: rgba(15, 17, 21, 0.75);
  border-bottom: 1px solid var(--border-soft);
}

.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: 1rem;
  gap: 1rem;
}

.app-header__nav {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.app-header__nav button {
  font: inherit;
}
</style>
