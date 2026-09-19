<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AppLogo from "./AppLogo.vue";
import ThemeToggle from "./ThemeToggle.vue";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const mobileOpen = ref(false);

// Cierra el menú mobile ante cualquier navegación (incluye atrás/adelante
// del navegador), no solo los clicks dentro del propio menú.
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);

async function onLogout(): Promise<void> {
  mobileOpen.value = false;
  await auth.logout();
  router.push("/");
}

function closeMobile(): void {
  mobileOpen.value = false;
}
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-border-soft bg-header backdrop-blur-md">
    <div class="container flex items-center justify-between gap-4 py-4">
      <AppLogo />

      <!-- Nav de escritorio: oculto por debajo de sm, visible desde sm en adelante. -->
      <nav class="hidden items-center gap-2.5 sm:flex">
        <template v-if="auth.isAuthenticated">
          <RouterLink v-if="auth.usuario && ['ORGANIZADOR', 'ADMINISTRADOR'].includes(auth.usuario.rol)" to="/torneos" class="btn btn-ghost">
            Mis torneos
          </RouterLink>
          <RouterLink to="/cuenta" class="btn btn-ghost">Mi cuenta</RouterLink>
          <button type="button" class="btn btn-ghost" @click="onLogout">Cerrar sesión</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost">Iniciar sesión</RouterLink>
          <RouterLink to="/registro" class="btn btn-primary">Crear cuenta</RouterLink>
        </template>
        <ThemeToggle />
      </nav>

      <!-- Controles de mobile: toggle de tema siempre visible + botón hamburguesa. -->
      <div class="flex items-center gap-2 sm:hidden">
        <ThemeToggle />
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text"
          :aria-expanded="mobileOpen"
          :aria-label="mobileOpen ? 'Cerrar menú' : 'Abrir menú'"
          @click="mobileOpen = !mobileOpen"
        >
          <svg v-if="!mobileOpen" viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Panel de nav de mobile: se abre debajo del header, oculto desde sm. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <nav v-if="mobileOpen" class="border-t border-border-soft bg-header sm:hidden">
        <div class="container flex flex-col gap-1 py-3">
          <template v-if="auth.isAuthenticated">
            <RouterLink
              v-if="auth.usuario && ['ORGANIZADOR', 'ADMINISTRADOR'].includes(auth.usuario.rol)"
              to="/torneos"
              class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10"
              @click="closeMobile"
            >
              Mis torneos
            </RouterLink>
            <RouterLink to="/cuenta" class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10" @click="closeMobile">
              Mi cuenta
            </RouterLink>
            <button type="button" class="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-text hover:bg-accent/10" @click="onLogout">
              Cerrar sesión
            </button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10" @click="closeMobile">
              Iniciar sesión
            </RouterLink>
            <RouterLink to="/registro" class="rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-semibold text-[#17130a]" @click="closeMobile">
              Crear cuenta
            </RouterLink>
          </template>
        </div>
      </nav>
    </Transition>
  </header>
</template>
