<script setup lang="ts">
import AppLogo from "./AppLogo.vue";

withDefaults(defineProps<{ title: string; subtitle?: string; quote?: string; quoteAuthor?: string }>(), {
  subtitle: undefined,
  quote: "El ajedrez no perdona ni la más pequeña falla.",
  quoteAuthor: "José Raúl Capablanca",
});
</script>

<template>
  <div class="auth-page">
    <header class="auth-header">
      <div class="container">
        <AppLogo />
      </div>
    </header>

    <main class="auth-main">
      <div class="container auth-layout">
        <aside class="auth-aside" aria-hidden="true">
          <span class="auth-aside__glyph">♞</span>
          <blockquote v-if="quote" class="auth-aside__quote">
            “{{ quote }}”
            <cite v-if="quoteAuthor">{{ quoteAuthor }}</cite>
          </blockquote>
        </aside>

        <section class="auth-card">
          <h1>{{ title }}</h1>
          <p v-if="subtitle" class="auth-card__subtitle">{{ subtitle }}</p>

          <slot name="banners" />
          <slot />

          <p v-if="$slots.footer" class="auth-card__footer"><slot name="footer" /></p>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.auth-header {
  padding-block: 1.5rem;
}

.auth-main {
  flex: 1;
  display: flex;
  align-items: center;
  padding-block: 1rem 3rem;
}

.auth-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: center;
}

@media (min-width: 860px) {
  .auth-layout {
    grid-template-columns: 1fr 1.1fr;
    gap: 3rem;
  }
}

.auth-aside {
  display: none;
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  background: linear-gradient(155deg, var(--surface) 0%, var(--bg-elevated) 100%);
  border: 1px solid var(--border-soft);
  min-height: 26rem;
  flex-direction: column;
  justify-content: space-between;
}

@media (min-width: 860px) {
  .auth-aside {
    display: flex;
  }
}

.auth-aside__glyph {
  font-size: 6rem;
  color: var(--accent);
  opacity: 0.85;
  line-height: 1;
}

.auth-aside__quote {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  line-height: 1.4;
  color: var(--text);
}

.auth-aside__quote cite {
  display: block;
  margin-top: 1rem;
  font-family: var(--font-sans);
  font-style: normal;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.auth-card {
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  padding: clamp(1.75rem, 4vw, 2.5rem);
  box-shadow: var(--shadow-lg);
}

.auth-card h1 {
  font-size: 1.7rem;
}

.auth-card__subtitle {
  margin: 0.35rem 0 1.5rem;
}

.auth-card :deep(form) {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.auth-card__footer {
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.88rem;
}

.auth-card__footer :deep(a) {
  color: var(--text-muted);
  text-decoration: none;
}

.auth-card__footer :deep(a:hover) {
  color: var(--accent);
}
</style>
