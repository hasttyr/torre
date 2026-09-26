<script setup lang="ts">
// `collapsible`: so the header's controls fit beside it on phones, the name
// gets smaller under 400px and, under 360px, only the rook shows (the name
// stays for screen readers).
withDefaults(defineProps<{ size?: "md" | "lg"; collapsible?: boolean }>(), { size: "md", collapsible: false });
</script>

<template>
  <RouterLink
    to="/"
    class="inline-flex items-center gap-2 font-display font-semibold text-text no-underline"
    :class="size === 'lg' ? 'text-2xl' : 'text-lg'"
  >
    <span class="leading-none text-accent" :class="size === 'lg' ? 'text-3xl' : 'text-2xl'" aria-hidden="true">♜</span>
    <span class="whitespace-nowrap" :class="{ 'max-[399px]:text-base max-[359px]:sr-only': collapsible }"
      >Torre Central Hub</span
    >
  </RouterLink>
</template>
