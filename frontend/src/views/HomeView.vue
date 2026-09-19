<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppHeader from "../components/AppHeader.vue";
import AppLogo from "../components/AppLogo.vue";

const { t } = useI18n();

const FEATURES = [
  { glyph: "♖", titleKey: "feature1Title", textKey: "feature1Text" },
  { glyph: "♕", titleKey: "feature2Title", textKey: "feature2Text" },
  { glyph: "♔", titleKey: "feature3Title", textKey: "feature3Text" },
  { glyph: "♘", titleKey: "feature4Title", textKey: "feature4Text" },
  { glyph: "♙", titleKey: "feature5Title", textKey: "feature5Text" },
  { glyph: "♗", titleKey: "feature6Title", textKey: "feature6Text" },
] as const;

const STEPS = [
  { n: "01", titleKey: "step1Title", textKey: "step1Text" },
  { n: "02", titleKey: "step2Title", textKey: "step2Text" },
  { n: "03", titleKey: "step3Title", textKey: "step3Text" },
  { n: "04", titleKey: "step4Title", textKey: "step4Text" },
] as const;
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main>
      <section class="relative overflow-hidden py-14 text-center sm:py-20 lg:py-28">
        <div
          class="pointer-events-none absolute -top-24 -right-12 text-[16rem] leading-none text-accent/6 select-none sm:text-[20rem] lg:text-[26rem]"
          aria-hidden="true"
        >
          ♜
        </div>
        <div class="container relative flex max-w-3xl flex-col items-center gap-5">
          <p class="text-xs font-semibold tracking-[0.08em] text-accent uppercase sm:text-sm">
            {{ t("home.eyebrow") }}
          </p>
          <h1 class="text-[2.1rem] leading-tight sm:text-5xl lg:text-6xl">
            {{ t("home.titleLine1") }}<br class="hidden sm:block" />
            {{ t("home.titleLine2") }}
          </h1>
          <p class="max-w-xl text-base text-text-muted sm:text-lg">
            {{ t("home.subtitle") }}
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-3">
            <RouterLink to="/registro" class="btn btn-primary">{{ t("home.ctaPrimary") }}</RouterLink>
            <a href="#funciona" class="btn btn-ghost">{{ t("home.ctaSecondary") }}</a>
          </div>
        </div>
      </section>

      <section id="funciona" class="py-12 sm:py-16 lg:py-20">
        <div class="container">
          <h2 class="mx-auto max-w-xl text-center text-[1.6rem] sm:text-3xl lg:text-4xl">
            {{ t("home.featuresTitle") }}
          </h2>
          <p class="mx-auto mt-3 max-w-xl text-center">
            {{ t("home.featuresSubtitle") }}
          </p>

          <div class="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="feature in FEATURES"
              :key="feature.titleKey"
              class="rounded-2xl border border-border-soft bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40"
            >
              <span class="mb-3 inline-flex text-2xl text-accent" aria-hidden="true">{{ feature.glyph }}</span>
              <h3 class="mb-1.5 text-base">{{ t(`home.${feature.titleKey}`) }}</h3>
              <p class="text-sm">{{ t(`home.${feature.textKey}`) }}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="border-y border-border-soft bg-bg-elevated py-12 sm:py-16 lg:py-20">
        <div class="container">
          <h2 class="mx-auto max-w-xl text-center text-[1.6rem] sm:text-3xl lg:text-4xl">
            {{ t("home.stepsTitle") }}
          </h2>

          <ol class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <li v-for="step in STEPS" :key="step.n" class="flex gap-4">
              <span class="shrink-0 font-display text-2xl text-accent">{{ step.n }}</span>
              <div>
                <h3 class="mb-1 text-base">{{ t(`home.${step.titleKey}`) }}</h3>
                <p class="text-sm">{{ t(`home.${step.textKey}`) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="py-12 sm:py-16 lg:py-20">
        <div class="container flex flex-col items-center gap-3 text-center">
          <h2 class="text-[1.6rem] sm:text-3xl">{{ t("home.ctaTitle") }}</h2>
          <p class="max-w-md">{{ t("home.ctaText") }}</p>
          <RouterLink to="/registro" class="btn btn-primary mt-2">{{ t("home.ctaButton") }}</RouterLink>
        </div>
      </section>
    </main>

    <footer class="mt-auto border-t border-border-soft py-8">
      <div class="container flex flex-wrap items-center justify-between gap-4 text-sm text-text-muted">
        <AppLogo size="md" />
        <p>{{ t("home.footerText") }}</p>
        <a href="https://github.com/hasttyr/torre" target="_blank" rel="noopener" class="text-text-muted no-underline hover:text-accent">
          GitHub
        </a>
      </div>
    </footer>
  </div>
</template>
