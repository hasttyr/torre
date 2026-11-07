<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";

import HeroBoard from "../components/home/HeroBoard.vue";
import ShowcaseTile from "../components/home/ShowcaseTile.vue";
import AppHeader from "../components/layout/AppHeader.vue";

// The landing stands on the app's photograph, shown plainly behind the
// hero (the headline, the board) and veiled below it, where the facts, the
// six features (two wide, then four alternating light and ink glass), the
// four steps and the closing call sit on glass panes; the name set at full
// width is the close.
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
// The hero's second action: a glass pill on the photograph.
const ON_PHOTO_SECONDARY = "glass-strong text-text ring-1 ring-glass-border hover:bg-surface";
// On ink glass both themes use the bright gold and an ivory outline.
const ON_INK_PRIMARY = "bg-tile-ink-accent text-tile-ink-on-accent hover:bg-tile-ink-accent-hover";
const ON_INK_SECONDARY =
  "border-tile-ink-text/25 text-tile-ink-text hover:border-tile-ink-text/55 hover:bg-tile-ink-text/8";

const year = new Date().getFullYear();
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />

    <main>
      <!-- The hero: the photograph under a lighter veil (only full-ink, large
           type sits on it), fading into the page's veiled ground below. The
           header floats over its top. -->
      <section class="relative isolate -mt-18 overflow-hidden pt-32 pb-20 text-center sm:pt-40 sm:pb-28 lg:pb-32">
        <div
          class="photo-stage absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
          aria-hidden="true"
        />
        <div class="container flex max-w-[1320px] flex-col items-center">
          <h1 class="text-[clamp(2.25rem,0.4rem+6.6vw,6.5rem)] leading-[0.98] tracking-[-0.045em]">
            {{ t("home.titleLine1") }}<br />
            <span class="text-accent-hover">{{ t("home.titleLine2") }}</span>
          </h1>
          <p
            class="mt-8 max-w-[38rem] text-[clamp(1.0625rem,0.95rem+0.45vw,1.3125rem)] leading-normal text-pretty text-text"
          >
            {{ t("home.subtitle") }}
          </p>
          <div class="mt-10 flex flex-wrap justify-center gap-3">
            <RouterLink to="/registro" class="btn btn-primary" :class="PILL">
              {{ t("home.ctaPrimary") }}
            </RouterLink>
            <a href="#funciona" class="btn" :class="[PILL, ON_PHOTO_SECONDARY]">{{ t("home.ctaSecondary") }}</a>
          </div>

          <div class="mt-16 w-full sm:mt-20 lg:mt-24">
            <HeroBoard />
          </div>
        </div>
      </section>

      <section class="container py-8 sm:py-12">
        <ul
          :aria-label="t('home.factsLabel')"
          class="pane m-0 grid list-none grid-cols-2 gap-x-6 gap-y-12 rounded-[28px] p-8 sm:p-12 lg:grid-cols-4"
        >
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

      <section id="funciona">
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

      <section class="py-20 sm:py-32">
        <div class="container">
          <h2 class="max-w-3xl text-[clamp(2.25rem,1.3rem+3.6vw,4.5rem)] leading-[1.02] tracking-[-0.04em]">
            {{ t("home.stepsTitle") }}
          </h2>

          <!-- A real sequence, so the numbers stay; set large and faint, they
               lead the eye without competing with the step's name. -->
          <ol class="m-0 mt-14 grid list-none gap-3 p-0 sm:mt-20 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <li v-for="step in STEPS" :key="step.n" class="pane flex flex-col gap-6 rounded-[28px] p-7 sm:p-8">
              <span
                class="font-display text-[clamp(3rem,2.4rem+2vw,4.25rem)] leading-none font-semibold tracking-[-0.05em] text-text/25 tabular-nums"
                aria-hidden="true"
              >
                {{ step.n }}
              </span>
              <div>
                <h3 class="text-title tracking-[-0.02em]">{{ t(`home.${step.titleKey}`) }}</h3>
                <p class="mt-2 text-base">{{ t(`home.${step.textKey}`) }}</p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section
        class="pane-ink relative mx-3 overflow-hidden rounded-[28px] py-24 text-center sm:mx-4 sm:py-32 lg:py-40"
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

    <footer class="mt-auto overflow-hidden pt-16 pb-8 sm:pt-24">
      <div class="container">
        <div class="pane grid gap-10 rounded-[28px] p-8 sm:grid-cols-[1.6fr_1fr_1fr] sm:p-12">
          <p class="max-w-xs text-base">{{ t("home.footerText") }}</p>
          <nav
            :aria-label="t('home.footerAccount')"
            class="flex flex-col items-start gap-2.5 text-base pointer-coarse:gap-0"
          >
            <span class="font-semibold text-text">{{ t("home.footerAccount") }}</span>
            <RouterLink to="/torneos-abiertos" class="tap text-text-muted no-underline hover:text-text">
              {{ t("header.openTournaments") }}
            </RouterLink>
            <RouterLink to="/login" class="tap text-text-muted no-underline hover:text-text">
              {{ t("header.login") }}
            </RouterLink>
            <RouterLink to="/registro" class="tap text-text-muted no-underline hover:text-text">
              {{ t("header.createAccount") }}
            </RouterLink>
            <RouterLink to="/politica-de-datos" class="tap text-text-muted no-underline hover:text-text">
              {{ t("dataPolicy.title") }}
            </RouterLink>
          </nav>
          <nav
            :aria-label="t('home.footerProject')"
            class="flex flex-col items-start gap-2.5 text-base pointer-coarse:gap-0"
          >
            <span class="font-semibold text-text">{{ t("home.footerProject") }}</span>
            <a href="#funciona" class="tap text-text-muted no-underline hover:text-text">{{
              t("home.ctaSecondary")
            }}</a>
            <a
              href="https://github.com/hasttyr/torre"
              target="_blank"
              rel="noopener"
              class="tap text-text-muted no-underline hover:text-text"
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

        <div class="mt-8 flex flex-col gap-1 text-sm text-text-muted sm:flex-row sm:justify-between">
          <span>{{ t("home.footerLegal", { year }) }}</span>
          <span>{{ t("home.eyebrow") }}</span>
        </div>
        <!-- The background photograph's credit, as its licence asks. -->
        <p class="mt-2 text-sm text-text-muted">
          {{ t("home.photoCredit") }}:
          <a
            href="https://commons.wikimedia.org/wiki/File:Chess_pieces_close_up.jpg"
            target="_blank"
            rel="noopener"
            class="text-text-muted underline-offset-2 hover:text-text"
            >“Chess pieces close up”</a
          >, Aaaatu,
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener"
            class="text-text-muted underline-offset-2 hover:text-text"
            >CC BY-SA 4.0</a
          >
        </p>
      </div>
    </footer>
  </div>
</template>
