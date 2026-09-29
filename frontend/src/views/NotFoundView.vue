<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppLogo from "../components/layout/AppLogo.vue";

const { t } = useI18n();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="py-6">
      <div class="container">
        <AppLogo />
      </div>
    </header>

    <main class="container flex flex-1 flex-col items-start justify-center gap-4 pb-24">
      <span class="text-7xl leading-none text-accent opacity-85" aria-hidden="true">♚</span>
      <h1 class="text-3xl sm:text-4xl">{{ t("notFound.title") }}</h1>
      <p class="max-w-prose">{{ t("notFound.message") }}</p>
      <RouterLink to="/" class="btn btn-primary">{{ t("notFound.home") }}</RouterLink>
    </main>
  </div>
</template>
