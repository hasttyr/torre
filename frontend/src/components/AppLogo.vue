<script setup lang="ts">
withDefaults(defineProps<{ size?: "md" | "lg" }>(), { size: "md" });
</script>

<template>
  <RouterLink
    to="/"
    class="inline-flex items-center gap-2 font-display font-semibold text-text no-underline"
    :class="size === 'lg' ? 'text-2xl' : 'text-lg'"
  >
    <span class="leading-none text-accent" :class="size === 'lg' ? 'text-3xl' : 'text-2xl'" aria-hidden="true">♜</span>
    <span>Torre Central Hub</span>
  </RouterLink>
</template>
