<script setup lang="ts">
import { DATA_POLICY_VERSION } from "@contracts";
import { useI18n } from "vue-i18n";

import AppHeader from "../components/layout/AppHeader.vue";

// RN-10 / HU21, Ley 1581: the text the authorization asked at sign-up
// refers to (#129). Until the university provides its official policy this
// is an academic draft, and says so first. Its version is the one the API
// records with each new consent; a new text bumps it (contracts/catalogs.ts).
const { t } = useI18n();

const SECTIONS = [
  "responsible",
  "data",
  "purposes",
  "sensitive",
  "visibility",
  "processors",
  "rights",
  "channel",
  "minors",
  "changes",
] as const;
</script>

<template>
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-2xl flex-col gap-6 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <div>
        <h1 class="page-title">{{ t("dataPolicy.title") }}</h1>
        <p class="mt-2 text-sm text-text-muted">{{ t("dataPolicy.version", { version: DATA_POLICY_VERSION }) }}</p>
      </div>

      <p class="banner border-accent/35 bg-accent/10 text-text" role="note" data-test="draft-notice">
        {{ t("dataPolicy.draftNotice") }}
      </p>

      <section v-for="section in SECTIONS" :key="section" class="flex flex-col gap-2">
        <h2 class="text-lg">{{ t(`dataPolicy.sections.${section}.title`) }}</h2>
        <p class="leading-relaxed">{{ t(`dataPolicy.sections.${section}.body`) }}</p>
      </section>
    </main>
  </div>
</template>
