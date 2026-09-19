<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AppLogo from "./AppLogo.vue";
import LocaleToggle from "./LocaleToggle.vue";
import ThemeToggle from "./ThemeToggle.vue";
import UserMenu from "./UserMenu.vue";

const auth = useAuthStore();
const route = useRoute();
const { t } = useI18n();
const mobileOpen = ref(false);

// Closes the mobile menu on any navigation (including browser back/forward),
// not just clicks inside the menu itself.
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);

/** Closes the mobile nav panel. */
function closeMobile(): void {
  mobileOpen.value = false;
}
</script>

<template>
  <header class="sticky top-0 z-10 border-b border-border-soft bg-header backdrop-blur-md">
    <div class="container flex items-center justify-between gap-4 py-4">
      <AppLogo />

      <!-- Desktop nav: hidden below sm, visible from sm upward. -->
      <nav class="hidden items-center gap-2.5 sm:flex">
        <template v-if="auth.isAuthenticated">
          <RouterLink v-if="auth.user && ['ORGANIZADOR', 'ADMINISTRADOR'].includes(auth.user.rol)" to="/torneos" class="btn btn-ghost">
            {{ t("header.misTorneos") }}
          </RouterLink>
          <RouterLink v-if="auth.user?.rol === 'JUGADOR'" to="/mis-torneos" class="btn btn-ghost">{{ t("header.torneos") }}</RouterLink>
          <UserMenu />
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost">{{ t("header.iniciarSesion") }}</RouterLink>
          <RouterLink to="/registro" class="btn btn-primary">{{ t("header.crearCuenta") }}</RouterLink>
          <LocaleToggle />
          <ThemeToggle />
        </template>
      </nav>

      <!-- Mobile controls: user menu or theme toggle + hamburger button. -->
      <div class="flex items-center gap-2 sm:hidden">
        <UserMenu v-if="auth.isAuthenticated" />
        <template v-else>
          <LocaleToggle />
          <ThemeToggle />
        </template>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text"
          :aria-expanded="mobileOpen"
          :aria-label="mobileOpen ? t('header.cerrarMenu') : t('header.abrirMenu')"
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

    <!-- Mobile nav panel: opens below the header, hidden from sm upward. -->
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
              v-if="auth.user && ['ORGANIZADOR', 'ADMINISTRADOR'].includes(auth.user.rol)"
              to="/torneos"
              class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10"
              @click="closeMobile"
            >
              {{ t("header.misTorneos") }}
            </RouterLink>
            <RouterLink
              v-if="auth.user?.rol === 'JUGADOR'"
              to="/mis-torneos"
              class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10"
              @click="closeMobile"
            >
              {{ t("header.torneos") }}
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink to="/login" class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10" @click="closeMobile">
              {{ t("header.iniciarSesion") }}
            </RouterLink>
            <RouterLink to="/registro" class="rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-semibold text-[#17130a]" @click="closeMobile">
              {{ t("header.crearCuenta") }}
            </RouterLink>
          </template>
        </div>
      </nav>
    </Transition>
  </header>
</template>
