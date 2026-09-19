<script setup lang="ts">
import { useThemeStore } from "../stores/theme";

const theme = useThemeStore();
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text transition-colors hover:border-accent/40 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    :aria-label="theme.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
    :title="theme.theme === 'dark' ? 'Modo claro' : 'Modo oscuro'"
    @click="theme.toggle()"
  >
    <svg v-if="theme.theme === 'dark'" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.75" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.55 1.55M18.25 18.25l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.55-1.55M18.25 5.75l1.55-1.55"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
      />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>
