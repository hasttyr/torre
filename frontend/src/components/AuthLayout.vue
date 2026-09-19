<script setup lang="ts">
import AppLogo from "./AppLogo.vue";

withDefaults(defineProps<{ title: string; subtitle?: string; quote?: string; quoteAuthor?: string }>(), {
  subtitle: undefined,
  quote: "El ajedrez no perdona ni la más pequeña falla.",
  quoteAuthor: "José Raúl Capablanca",
});
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="py-6">
      <div class="container">
        <AppLogo />
      </div>
    </header>

    <main class="flex flex-1 items-center py-4 pb-12">
      <div class="container grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12">
        <aside
          class="hidden min-h-104 flex-col justify-between rounded-3xl border border-border-soft bg-linear-to-br from-surface to-bg-elevated p-8 md:p-12 md:flex"
          aria-hidden="true"
        >
          <span class="text-8xl leading-none text-accent opacity-85">♞</span>
          <blockquote v-if="quote" class="m-0 font-display text-2xl leading-snug text-text">
            “{{ quote }}”
            <cite v-if="quoteAuthor" class="mt-4 block font-sans text-sm not-italic text-text-muted">{{
              quoteAuthor
            }}</cite>
          </blockquote>
        </aside>

        <section class="card shadow-lg sm:p-10">
          <h1 class="text-2xl sm:text-3xl">{{ title }}</h1>
          <p v-if="subtitle" class="mt-1.5 mb-6">{{ subtitle }}</p>

          <div class="flex flex-col gap-3">
            <slot name="banners" />
          </div>
          <div class="[&_form]:flex [&_form]:flex-col [&_form]:gap-4">
            <slot />
          </div>

          <p v-if="$slots.footer" class="mt-5 text-center text-sm [&_a]:text-text-muted [&_a]:no-underline [&_a:hover]:text-accent">
            <slot name="footer" />
          </p>
        </section>
      </div>
    </main>
  </div>
</template>
