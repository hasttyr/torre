<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { navLinks } from "../../lib/navigation";
import { prefetchRoute } from "../../lib/prefetchRoute";
import { useAuthStore } from "../../stores/auth";
import AppLogo from "./AppLogo.vue";
import LazyUserMenu from "./LazyUserMenu.vue";
import LocaleToggle from "../ui/LocaleToggle.vue";
import ThemeToggle from "../ui/ThemeToggle.vue";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

/** Pointing at (or tabbing to) a section's link starts downloading its page. */
const prefetch = (to: string): void => prefetchRoute(router, to);
const { t } = useI18n();
const mobileOpen = ref(false);

// The role's sections, for both the desktop and the mobile nav: each route
// declares whether it's a section and who may open it (meta.nav, meta.roles
// in router/index.ts), so adding one is a single change there.
const navItems = computed(() => navLinks(router.getRoutes(), auth.user?.role));

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

const menuButton = useTemplateRef<HTMLButtonElement>("menuButton");

/** Escape closes the mobile nav panel, handing focus back to the button that opened it. */
function closeMobileFromKeyboard(): void {
  if (!mobileOpen.value) return;
  closeMobile();
  menuButton.value?.focus();
}
</script>

<template>
  <header
    class="glass-strong sticky top-0 z-10 pt-[env(safe-area-inset-top)] shadow-[inset_0_-1px_0_var(--glass-border)]"
    @keydown.esc="closeMobileFromKeyboard"
  >
    <div class="container flex min-h-16 items-center justify-between gap-4 py-2.5">
      <AppLogo collapsible />

      <!-- Desktop nav: hidden below lg (an administrator has up to six links,
           which would overflow a tablet-width bar), visible from lg upward. -->
      <nav class="hidden items-center gap-1 lg:flex">
        <template v-if="auth.isAuthenticated">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-3.5 py-2 text-[0.875rem] font-medium text-text-muted no-underline transition-colors hover:text-text [&.router-link-active]:bg-text/8 [&.router-link-active]:text-text"
            @mouseenter="prefetch(item.to)"
            @focus="prefetch(item.to)"
          >
            {{ t(item.labelKey) }}
          </RouterLink>
          <LazyUserMenu />
        </template>
        <template v-else>
          <RouterLink
            to="/login"
            class="rounded-full px-3.5 py-2 text-[0.875rem] font-medium text-text-muted no-underline transition-colors hover:text-text"
            >{{ t("header.login") }}</RouterLink
          >
          <RouterLink to="/registro" class="btn btn-primary ml-1 min-h-9 px-4 py-1.5 text-[0.875rem]">{{
            t("header.createAccount")
          }}</RouterLink>
          <LocaleToggle />
          <ThemeToggle />
        </template>
      </nav>

      <!-- Mobile controls: user menu or theme toggle + hamburger button. -->
      <div class="flex items-center gap-2 lg:hidden">
        <LazyUserMenu v-if="auth.isAuthenticated" />
        <template v-else>
          <LocaleToggle />
          <ThemeToggle />
        </template>
        <button
          ref="menuButton"
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-text/6 text-text transition-[background-color,scale] hover:bg-text/12 active:scale-95"
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
      <nav v-if="mobileOpen" class="lg:hidden">
        <div class="container flex flex-col gap-1 pt-2 pb-6">
          <template v-if="auth.isAuthenticated">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="rounded-2xl px-3 py-3 text-[1.375rem] font-semibold tracking-[-0.02em] text-text no-underline hover:bg-text/6"
              @click="closeMobile"
              @touchstart.passive="prefetch(item.to)"
              @focus="prefetch(item.to)"
            >
              {{ t(item.labelKey) }}
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="rounded-2xl px-3 py-3 text-[1.375rem] font-semibold tracking-[-0.02em] text-text no-underline hover:bg-text/6"
              @click="closeMobile"
            >
              {{ t("header.login") }}
            </RouterLink>
            <RouterLink to="/registro" class="btn btn-primary mt-3 text-base" @click="closeMobile">
              {{ t("header.createAccount") }}
            </RouterLink>
          </template>
        </div>
      </nav>
    </Transition>
  </header>
</template>
