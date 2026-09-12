<script setup lang="ts">
withDefaults(defineProps<{ size?: "md" | "lg" }>(), { size: "md" });
</script>

<template>
  <RouterLink to="/" class="app-logo" :class="`app-logo--${size}`">
    <span class="app-logo__glyph" aria-hidden="true">♜</span>
    <span class="app-logo__word">Torre Central Hub</span>
  </RouterLink>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 600;
}

.app-logo__glyph {
  color: var(--accent);
  line-height: 1;
}

.app-logo--md {
  font-size: 1.15rem;
}

.app-logo--md .app-logo__glyph {
  font-size: 1.5rem;
}

.app-logo--lg {
  font-size: 1.5rem;
}

.app-logo--lg .app-logo__glyph {
  font-size: 2rem;
}
</style>
