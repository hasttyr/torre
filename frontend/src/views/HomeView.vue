<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";

import HeroBoard from "../components/home/HeroBoard.vue";
import ShowcaseTile from "../components/home/ShowcaseTile.vue";
import AppHeader from "../components/layout/AppHeader.vue";
import AppLogo from "../components/layout/AppLogo.vue";

// The landing is a stack of tiles whose change of surface is the only
// divider: the hero, the facts, the six features (two wide, then four in a
// checkerboard of light and ink tiles), the four steps, and a closing call
// on ink.
const { t } = useI18n();

// The features' illustrations are below the fold: they come in one chunk
// fetched when the landing mounts, so the other pages' startup bundle
// doesn't carry them. The hero's board stays in, as it's the first thing seen.
const showcase = () => import("../components/home/showcase");
const PairingsMock = defineAsyncComponent(() => showcase().then((module) => module.PairingsMock));
const StandingsMock = defineAsyncComponent(() => showcase().then((module) => module.StandingsMock));
const RolesMock = defineAsyncComponent(() => showcase().then((module) => module.RolesMock));
const ResultMock = defineAsyncComponent(() => showcase().then((module) => module.ResultMock));
const ExportMock = defineAsyncComponent(() => showcase().then((module) => module.ExportMock));
const AuditMock = defineAsyncComponent(() => showcase().then((module) => module.AuditMock));

const FACTS = [1, 2, 3, 4] as const;

const STEPS = [
  { n: "01", titleKey: "step1Title", textKey: "step1Text" },
  { n: "02", titleKey: "step2Title", textKey: "step2Text" },
  { n: "03", titleKey: "step3Title", textKey: "step3Text" },
  { n: "04", titleKey: "step4Title", textKey: "step4Text" },
] as const;

// Pill-shaped calls to action that press in when tapped; no hover shadow.
const PILL =
  "rounded-full px-7 hover:shadow-none active:scale-95 transition-[translate,scale,background-color,border-color]";

const year = new Date().getFullYear();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main>
      <section class="overflow-hidden bg-bg pt-12 pb-16 text-center sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div class="container flex flex-col items-center">
          <p class="text-sm font-semibold text-text-muted">{{ t("home.eyebrow") }}</p>
          <h1 class="mt-4 max-w-6xl text-[clamp(2.3rem,1.2rem+4.6vw,4.75rem)] leading-[1.03] tracking-tight">
            {{ t("home.titleLine1") }}<br class="hidden sm:block" />
            {{ t("home.titleLine2") }}
          </h1>
          <p class="mt-5 max-w-xl text-[clamp(1.05rem,0.98rem+0.4vw,1.3rem)] text-pretty lg:max-w-2xl">
            {{ t("home.subtitle") }}
          </p>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <RouterLink to="/registro" class="btn btn-primary" :class="PILL">{{ t("home.ctaPrimary") }}</RouterLink>
            <a href="#funciona" class="btn btn-ghost" :class="PILL">{{ t("home.ctaSecondary") }}</a>
          </div>

          <div class="mt-12 w-full sm:mt-16">
            <HeroBoard />
          </div>
        </div>
      </section>

      <section class="border-y border-border-soft bg-bg-elevated py-10 sm:py-12">
        <ul :aria-label="t('home.factsLabel')" class="container grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          <li
            v-for="n in FACTS"
            :key="n"
            class="flex flex-col gap-2 lg:border-l lg:border-border-soft lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
          >
            <strong
              class="font-display text-[clamp(2.25rem,1.8rem+1.8vw,3.5rem)] leading-none font-semibold tracking-[-0.02em] text-text"
            >
              {{ t(`home.fact${n}Value`) }}
            </strong>
            <span class="max-w-[24ch] text-sm text-text-muted">{{ t(`home.fact${n}Label`) }}</span>
          </li>
        </ul>
      </section>

      <section id="funciona" class="bg-bg">
        <div class="container pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
          <h2 class="mx-auto max-w-2xl text-[clamp(1.9rem,1.4rem+2.2vw,3.25rem)] tracking-[-0.02em]">
            {{ t("home.featuresTitle") }}
          </h2>
          <p class="mx-auto mt-4 max-w-xl text-[clamp(1rem,0.95rem+0.3vw,1.2rem)] text-pretty">
            {{ t("home.featuresSubtitle") }}
          </p>
        </div>

        <div class="flex flex-col gap-3 pb-3 sm:px-3">
          <ShowcaseTile wide surface="ink" :title="t('home.feature1Title')" :text="t('home.feature1Text')">
            <PairingsMock />
          </ShowcaseTile>
          <ShowcaseTile wide surface="elevated" :title="t('home.feature2Title')" :text="t('home.feature2Text')">
            <StandingsMock />
          </ShowcaseTile>
          <div class="grid gap-3 md:grid-cols-2">
            <ShowcaseTile surface="elevated" :title="t('home.feature3Title')" :text="t('home.feature3Text')">
              <RolesMock />
            </ShowcaseTile>
            <ShowcaseTile surface="ink" :title="t('home.feature4Title')" :text="t('home.feature4Text')">
              <ResultMock />
            </ShowcaseTile>
            <ShowcaseTile surface="ink" :title="t('home.feature5Title')" :text="t('home.feature5Text')">
              <ExportMock />
            </ShowcaseTile>
            <ShowcaseTile surface="elevated" :title="t('home.feature6Title')" :text="t('home.feature6Text')">
              <AuditMock />
            </ShowcaseTile>
          </div>
        </div>
      </section>

      <section class="border-y border-border-soft bg-bg-elevated py-16 sm:py-24">
        <div class="container">
          <h2 class="mx-auto max-w-xl text-center text-[clamp(1.9rem,1.4rem+2.2vw,3.25rem)] tracking-[-0.02em]">
            {{ t("home.stepsTitle") }}
          </h2>

          <ol class="mx-auto mt-12 grid max-w-md gap-8 sm:mt-16 lg:max-w-none lg:grid-cols-4 lg:gap-6">
            <li
              v-for="step in STEPS"
              :key="step.n"
              class="relative flex gap-5 not-last:after:absolute not-last:after:top-14 not-last:after:-bottom-6 not-last:after:left-[1.375rem] not-last:after:w-px not-last:after:bg-border lg:flex-col lg:gap-5 lg:not-last:after:top-[1.375rem] lg:not-last:after:right-3 lg:not-last:after:bottom-auto lg:not-last:after:left-16 lg:not-last:after:h-px lg:not-last:after:w-auto"
            >
              <span
                class="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent/60 font-display text-base text-text tabular-nums"
              >
                {{ step.n }}
              </span>
              <div>
                <h3 class="text-lg">{{ t(`home.${step.titleKey}`) }}</h3>
                <p class="mt-1.5 text-[0.95rem]">{{ t(`home.${step.textKey}`) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section class="relative overflow-hidden bg-tile-ink py-20 text-center sm:py-28 lg:py-32">
        <span
          class="pointer-events-none absolute -right-10 -bottom-24 font-display text-[20rem] leading-none text-tile-ink-text/5 select-none sm:-bottom-32 sm:text-[28rem] lg:right-[6%]"
          aria-hidden="true"
        >
          ♜
        </span>
        <div class="container relative flex flex-col items-center">
          <h2 class="text-[clamp(2rem,1.4rem+2.6vw,3.5rem)] tracking-[-0.02em] text-tile-ink-text">
            {{ t("home.ctaTitle") }}
          </h2>
          <p class="mt-4 max-w-md text-[clamp(1rem,0.95rem+0.3vw,1.2rem)] text-pretty text-tile-ink-muted">
            {{ t("home.ctaText") }}
          </p>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <RouterLink
              to="/registro"
              class="btn bg-tile-ink-accent text-tile-ink-on-accent hover:-translate-y-px hover:bg-tile-ink-accent-hover"
              :class="PILL"
            >
              {{ t("home.ctaButton") }}
            </RouterLink>
            <RouterLink
              to="/login"
              class="btn border-tile-ink-text/25 text-tile-ink-text hover:border-tile-ink-text/50 hover:bg-tile-ink-text/10"
              :class="PILL"
            >
              {{ t("home.ctaLogin") }}
            </RouterLink>
          </div>
        </div>
      </section>
    </main>

    <footer class="mt-auto bg-bg pt-12 pb-8 sm:pt-16">
      <div class="container">
        <div class="grid gap-10 sm:grid-cols-[1.6fr_1fr_1fr]">
          <div class="flex flex-col gap-3">
            <AppLogo />
            <p class="max-w-xs text-sm">{{ t("home.footerText") }}</p>
          </div>
          <nav :aria-label="t('home.footerAccount')" class="flex flex-col gap-2 text-sm">
            <span class="font-semibold text-text">{{ t("home.footerAccount") }}</span>
            <RouterLink to="/login" class="text-text-muted no-underline hover:text-accent">
              {{ t("header.login") }}
            </RouterLink>
            <RouterLink to="/registro" class="text-text-muted no-underline hover:text-accent">
              {{ t("header.createAccount") }}
            </RouterLink>
          </nav>
          <nav :aria-label="t('home.footerProject')" class="flex flex-col gap-2 text-sm">
            <span class="font-semibold text-text">{{ t("home.footerProject") }}</span>
            <a href="#funciona" class="text-text-muted no-underline hover:text-accent">{{ t("home.ctaSecondary") }}</a>
            <a
              href="https://github.com/hasttyr/torre"
              target="_blank"
              rel="noopener"
              class="text-text-muted no-underline hover:text-accent"
            >
              {{ t("home.footerCode") }}
            </a>
          </nav>
        </div>
        <p class="mt-12 border-t border-border-soft pt-6 text-xs text-text-faint">
          {{ t("home.footerLegal", { year }) }}
        </p>
      </div>
    </footer>
  </div>
</template>
