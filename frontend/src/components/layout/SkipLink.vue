<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// First stop for keyboard users on every page (App.vue renders it before
// the route): jumps past the header's links straight to the content. Every
// view has exactly one <main>, so it's found by tag instead of threading an
// id through all of them.
function skipToMain(): void {
  const main = document.querySelector("main");
  if (!main) return;
  main.setAttribute("tabindex", "-1");
  main.focus();
}
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[#17130a]"
    @click.prevent="skipToMain"
  >
    {{ t("common.skipToContent") }}
  </a>
</template>
