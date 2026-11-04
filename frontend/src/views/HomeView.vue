<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";

import HeroBoard from "../components/home/HeroBoard.vue";
import ShowcaseTile from "../components/home/ShowcaseTile.vue";
import AppHeader from "../components/layout/AppHeader.vue";

// The landing is a gallery: a dark stage where the board stands as the
// piece on show, the facts, the six features (two wide, then four in a
// checkerboard of light and ink cards), the four steps, a closing call on
// ink, and the name set at full width as the close.
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

// The landing's large calls to action: a little taller than the app's buttons.
const PILL = "min-h-12 px-8 text-base";
// On the dark stage both themes use the bright gold and an ivory outline.
const ON_INK_PRIMARY = "bg-tile-ink-accent text-tile-ink-on-accent hover:bg-tile-ink-accent-hover";
const ON_INK_SECONDARY =
  "border-tile-ink-text/25 text-tile-ink-text hover:border-tile-ink-text/55 hover:bg-tile-ink-text/8";

const year = new Date().getFullYear();
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />

    <main>
      <!-- The stage: dark in both themes, like a vitrine, so the board's wood
           and gold carry the color. -->
      <section class="overflow-hidden bg-tile-ink pt-16 pb-20 text-center sm:pt-24 sm:pb-28 lg:pt-28 lg:pb-32">
        <div class="container flex max-w-[1320px] flex-col items-center">
          <h1 class="text-[clamp(2.25rem,0.4rem+6.6vw,6.5rem)] leading-[0.98] tracking-[-0.045em] text-tile-ink-text">
            {{ t("home.titleLine1") }}<br />
            {{ t("home.titleLine2") }}
          </h1>
          <p
            class="mt-8 max-w-[38rem] text-[clamp(1.0625rem,0.95rem+0.45vw,1.3125rem)] leading-normal text-pretty text-tile-ink-muted"
          >
            {{ t("home.subtitle") }}
          </p>
          <div class="mt-10 flex flex-wrap justify-center gap-3">
            <RouterLink to="/registro" class="btn" :class="[PILL, ON_INK_PRIMARY]">
              {{ t("home.ctaPrimary") }}
            </RouterLink>
            <a href="#funciona" class="btn" :class="[PILL, ON_INK_SECONDARY]">{{ t("home.ctaSecondary") }}</a>
          </div>

          <div class="mt-16 w-full sm:mt-20 lg:mt-24">
            <HeroBoard />
          </div>
        </div>
      </section>

      <section class="bg-bg py-16 sm:py-24">
        <ul :aria-label="t('home.factsLabel')" class="container grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          <li v-for="n in FACTS" :key="n" class="flex flex-col gap-3">
            <strong
              class="font-display text-[clamp(3rem,2rem+3.6vw,5.5rem)] leading-[0.9] font-semibold tracking-[-0.05em] text-accent"
            >
              {{ t(`home.fact${n}Value`) }}
            </strong>
            <span class="max-w-[24ch] text-base text-text-muted">{{ t(`home.fact${n}Label`) }}</span>
          </li>
        </ul>
      </section>

      <section id="funciona" class="bg-bg">
        <div class="container pt-8 pb-14 text-center sm:pt-16 sm:pb-20">
          <h2 class="mx-auto max-w-4xl text-[clamp(2.25rem,1.3rem+3.6vw,4.5rem)] leading-[1.02] tracking-[-0.04em]">
            {{ t("home.featuresTitle") }}
          </h2>
          <p class="mx-auto mt-6 max-w-xl text-[clamp(1.0625rem,0.95rem+0.4vw,1.3125rem)] text-pretty">
            {{ t("home.featuresSubtitle") }}
          </p>
        </div>

        <div class="flex flex-col gap-3 px-3 pb-3 sm:gap-4 sm:px-4 sm:pb-4">
          <ShowcaseTile wide surface="ink" :title="t('home.feature1Title')" :text="t('home.feature1Text')">
            <PairingsMock />
          </ShowcaseTile>
          <ShowcaseTile wide surface="elevated" :title="t('home.feature2Title')" :text="t('home.feature2Text')">
            <StandingsMock />
          </ShowcaseTile>
          <div class="grid gap-3 sm:gap-4 md:grid-cols-2">
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

      <section class="bg-bg py-20 sm:py-32">
        <div class="container">
          <h2 class="max-w-3xl text-[clamp(2.25rem,1.3rem+3.6vw,4.5rem)] leading-[1.02] tracking-[-0.04em]">
            {{ t("home.stepsTitle") }}
          </h2>

          <!-- A real sequence, so the numbers stay; set large and faint, they
               lead the eye without competing with the step's name. -->
          <ol class="mt-14 grid gap-x-8 gap-y-12 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4">
            <li v-for="step in STEPS" :key="step.n" class="flex flex-col gap-4">
              <span
                class="font-display text-[clamp(3rem,2.4rem+2vw,4.25rem)] leading-none font-semibold tracking-[-0.05em] text-text/25 tabular-nums"
                aria-hidden="true"
              >
                {{ step.n }}
              </span>
              <div>
                <h3 class="text-[1.375rem] tracking-[-0.02em]">{{ t(`home.${step.titleKey}`) }}</h3>
                <p class="mt-2 text-base">{{ t(`home.${step.textKey}`) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section
        class="relative mx-3 overflow-hidden rounded-[28px] bg-tile-ink py-24 text-center sm:mx-4 sm:py-32 lg:py-40"
      >
        <span
          class="pointer-events-none absolute -right-10 -bottom-24 font-display text-[20rem] leading-none text-tile-ink-accent/10 select-none sm:-bottom-32 sm:text-[30rem] lg:right-[5%]"
          aria-hidden="true"
        >
          ♜
        </span>
        <div class="container relative flex flex-col items-center">
          <h2 class="text-[clamp(2.5rem,1.4rem+4.2vw,5rem)] leading-none tracking-[-0.045em] text-tile-ink-text">
            {{ t("home.ctaTitle") }}
          </h2>
          <p class="mt-6 max-w-md text-[clamp(1.0625rem,0.95rem+0.4vw,1.3125rem)] text-pretty text-tile-ink-muted">
            {{ t("home.ctaText") }}
          </p>
          <div class="mt-10 flex flex-wrap justify-center gap-3">
            <RouterLink to="/registro" class="btn" :class="[PILL, ON_INK_PRIMARY]">
              {{ t("home.ctaButton") }}
            </RouterLink>
            <RouterLink to="/login" class="btn" :class="[PILL, ON_INK_SECONDARY]">
              {{ t("home.ctaLogin") }}
            </RouterLink>
          </div>
        </div>
      </section>
    </main>

    <footer class="mt-auto overflow-hidden bg-bg pt-16 pb-8 sm:pt-24">
      <div class="container">
        <div class="grid gap-10 sm:grid-cols-[1.6fr_1fr_1fr]">
          <p class="max-w-xs text-base">{{ t("home.footerText") }}</p>
          <nav :aria-label="t('home.footerAccount')" class="flex flex-col gap-2.5 text-base">
            <span class="font-semibold text-text">{{ t("home.footerAccount") }}</span>
            <RouterLink to="/login" class="text-text-muted no-underline hover:text-text">
              {{ t("header.login") }}
            </RouterLink>
            <RouterLink to="/registro" class="text-text-muted no-underline hover:text-text">
              {{ t("header.createAccount") }}
            </RouterLink>
          </nav>
          <nav :aria-label="t('home.footerProject')" class="flex flex-col gap-2.5 text-base">
            <span class="font-semibold text-text">{{ t("home.footerProject") }}</span>
            <a href="#funciona" class="text-text-muted no-underline hover:text-text">{{ t("home.ctaSecondary") }}</a>
            <a
              href="https://github.com/hasttyr/torre"
              target="_blank"
              rel="noopener"
              class="text-text-muted no-underline hover:text-text"
            >
              {{ t("home.footerCode") }}
            </a>
          </nav>
        </div>

        <!-- The name returns at full width as the page's close. -->
        <p
          class="mt-20 flex items-baseline gap-[0.12em] font-display text-[clamp(2.4rem,-0.4rem+9.4vw,9.25rem)] leading-[0.9] font-semibold tracking-[-0.055em] whitespace-nowrap text-text sm:mt-28"
          aria-hidden="true"
        >
          <span class="text-accent">♜</span>Torre Central Hub
        </p>

        <div class="mt-8 flex flex-col gap-1 text-sm text-text-faint sm:flex-row sm:justify-between">
          <span>{{ t("home.footerLegal", { year }) }}</span>
          <span>{{ t("home.eyebrow") }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>
