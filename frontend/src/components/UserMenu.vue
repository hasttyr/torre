<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth";
import { useLocaleStore } from "../stores/locale";
import { useThemeStore } from "../stores/theme";

const auth = useAuthStore();
const theme = useThemeStore();
const locale = useLocaleStore();
const router = useRouter();
const { t } = useI18n();

const open = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const initials = computed((): string => {
  const nombre = auth.usuario?.nombre?.trim() ?? "";
  const palabras = nombre.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  const primera = palabras[0][0];
  const media = palabras[Math.floor(palabras.length / 2)][0];
  return `${primera}${media}`.toUpperCase();
});

function toggleMenu(): void {
  open.value = !open.value;
}

function closeMenu(): void {
  open.value = false;
}

function goToProfile(): void {
  closeMenu();
  router.push("/cuenta");
}

async function onLogout(): Promise<void> {
  closeMenu();
  await auth.logout();
  router.push("/");
}

function onDocumentClick(event: MouseEvent): void {
  if (!menuRef.value) return;
  if (!menuRef.value.contains(event.target as Node)) {
    closeMenu();
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      type="button"
      class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[#17130a] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      :aria-expanded="open"
      aria-haspopup="true"
      :aria-label="t('userMenu.menuAria', { name: auth.usuario?.nombre ?? '' })"
      @click="toggleMenu"
    >
      {{ initials }}
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-header shadow-lg"
      >
        <div class="border-b border-border-soft px-3 py-2.5">
          <p class="truncate text-sm font-semibold text-text">{{ auth.usuario?.nombre }}</p>
          <p class="truncate text-xs text-text-soft">{{ auth.usuario?.email }}</p>
        </div>

        <div class="flex items-center justify-between px-3 py-2.5">
          <span class="text-sm text-text">{{ t("userMenu.tema") }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text transition-colors hover:border-accent/40 hover:bg-accent/10"
            @click="theme.toggle()"
          >
            <svg v-if="theme.theme === 'dark'" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.75" />
              <path
                d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.55 1.55M18.25 18.25l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.55-1.55M18.25 5.75l1.55-1.55"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <path
                d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linejoin="round"
              />
            </svg>
            {{ theme.theme === "dark" ? t("userMenu.oscuro") : t("userMenu.claro") }}
          </button>
        </div>

        <div class="flex items-center justify-between px-3 py-2.5">
          <span class="text-sm text-text">{{ t("userMenu.idioma") }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text transition-colors hover:border-accent/40 hover:bg-accent/10"
            @click="locale.toggle()"
          >
            {{ locale.locale.toUpperCase() }}
          </button>
        </div>

        <div class="border-t border-border-soft py-1.5">
          <button
            type="button"
            class="block w-full px-3 py-2 text-left text-sm font-medium text-text hover:bg-accent/10"
            @click="goToProfile"
          >
            {{ t("userMenu.miPerfil") }}
          </button>
          <button
            type="button"
            class="block w-full px-3 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-500/10"
            @click="onLogout"
          >
            {{ t("userMenu.cerrarSesion") }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
