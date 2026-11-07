<script setup lang="ts">
import { useI18n } from "vue-i18n";

import AppLogo from "./AppLogo.vue";

const { t } = useI18n();

withDefaults(defineProps<{ title: string; subtitle?: string; quote?: string; quoteAuthor?: string }>(), {
  subtitle: undefined,
  quote: undefined,
  quoteAuthor: undefined,
});
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="py-6">
      <div class="container">
        <AppLogo />
      </div>
    </header>

    <main class="flex flex-1 items-center py-4 pb-12">
      <div class="container grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_1.05fr]">
        <!-- The app's photograph under a dark veil in both themes: the gold
             knight stands on it like a piece on show, with a line from a
             master in full ivory. -->
        <aside
          class="photo-stage relative hidden min-h-[36rem] flex-col justify-end overflow-hidden rounded-[28px] p-10 shadow-lg [--veil-soft:rgb(7_8_11/72%)] md:flex lg:p-14"
          aria-hidden="true"
        >
          <span
            class="pointer-events-none absolute top-10 right-10 font-display text-[12rem] leading-none text-tile-ink-accent select-none lg:top-12 lg:right-12 lg:text-[14rem]"
            >♞</span
          >
          <blockquote
            class="relative m-0 max-w-[24ch] font-display text-[clamp(1.625rem,1.2rem+1vw,2.125rem)] leading-[1.15] font-semibold tracking-[-0.03em] text-tile-ink-text"
          >
            “{{ quote ?? t("authLayout.defaultQuote") }}”
            <cite class="mt-6 block font-sans text-base font-normal tracking-normal not-italic text-tile-ink-text">{{
              quoteAuthor ?? t("authLayout.defaultQuoteAuthor")
            }}</cite>
          </blockquote>
        </aside>

        <section class="card flex flex-col justify-center sm:p-12">
          <h1 class="text-[clamp(2rem,1.5rem+1.8vw,2.75rem)] leading-[1.05] tracking-[-0.035em]">{{ title }}</h1>
          <p v-if="subtitle" class="mt-3 mb-8">{{ subtitle }}</p>

          <div class="flex flex-col gap-3">
            <slot name="banners" />
          </div>
          <div class="[&_form]:flex [&_form]:flex-col [&_form]:gap-5">
            <slot />
          </div>

          <p
            v-if="$slots.footer"
            class="mt-6 text-center text-body-sm [&_a]:text-text-muted [&_a]:no-underline [&_a:hover]:text-text"
          >
            <slot name="footer" />
          </p>
        </section>
      </div>
    </main>
  </div>
</template>
