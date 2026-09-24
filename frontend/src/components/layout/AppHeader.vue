<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import { useAuthStore } from "../../stores/auth";
import AppLogo from "./AppLogo.vue";
import LocaleToggle from "../ui/LocaleToggle.vue";
import ThemeToggle from "../ui/ThemeToggle.vue";
import UserMenu from "./UserMenu.vue";

const auth = useAuthStore();
const route = useRoute();
const { t } = useI18n();
const mobileOpen = ref(false);

// Role-gated links, declared once for both the desktop and the mobile nav.
// `roles` mirrors each route's meta.roles in router/index.ts; omitted = any
// authenticated user.
const NAV_ITEMS: { to: string; labelKey: string; roles?: string[] }[] = [
  { to: "/panel", labelKey: "header.panel" },
  { to: "/torneos", labelKey: "header.myTournaments", roles: ["ORGANIZER", "ADMINISTRATOR"] },
  { to: "/clubes", labelKey: "header.clubs", roles: ["ORGANIZER", "ADMINISTRATOR"] },
  { to: "/mis-torneos", labelKey: "header.tournaments", roles: ["PLAYER"] },
  { to: "/mis-jugadores", labelKey: "header.myPlayers", roles: ["COACH"] },
  { to: "/usuarios", labelKey: "header.users", roles: ["ADMINISTRATOR"] },
  { to: "/auditoria", labelKey: "header.auditLog", roles: ["ADMINISTRATOR"] },
];

const navItems = computed(() => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(auth.user?.role ?? "")));

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

      <!-- Desktop nav: hidden below lg (an administrator has up to six links,
           which would overflow a tablet-width bar), visible from lg upward. -->
      <nav class="hidden items-center gap-1.5 lg:flex">
        <template v-if="auth.isAuthenticated">
          <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="btn btn-ghost px-4 py-2.5">
            {{ t(item.labelKey) }}
          </RouterLink>
          <UserMenu />
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost">{{ t("header.login") }}</RouterLink>
          <RouterLink to="/registro" class="btn btn-primary">{{ t("header.createAccount") }}</RouterLink>
          <LocaleToggle />
          <ThemeToggle />
        </template>
      </nav>

      <!-- Mobile controls: user menu or theme toggle + hamburger button. -->
      <div class="flex items-center gap-2 lg:hidden">
        <UserMenu v-if="auth.isAuthenticated" />
        <template v-else>
          <LocaleToggle />
          <ThemeToggle />
        </template>
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text"
          :aria-expanded="mobileOpen"
          :aria-label="mobileOpen ? t('header.closeMenu') : t('header.openMenu')"
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

    <!-- Mobile nav panel: opens below the header, hidden from lg upward. -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <nav v-if="mobileOpen" class="border-t border-border-soft bg-header lg:hidden">
        <div class="container flex flex-col gap-1 py-3">
          <template v-if="auth.isAuthenticated">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10"
              @click="closeMobile"
            >
              {{ t(item.labelKey) }}
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="rounded-lg px-3 py-2.5 text-sm font-semibold text-text hover:bg-accent/10"
              @click="closeMobile"
            >
              {{ t("header.login") }}
            </RouterLink>
            <RouterLink
              to="/registro"
              class="rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-semibold text-[#17130a]"
              @click="closeMobile"
            >
              {{ t("header.createAccount") }}
            </RouterLink>
          </template>
        </div>
      </nav>
    </Transition>
  </header>
</template>
