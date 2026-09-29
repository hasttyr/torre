<script setup lang="ts">
// How an action went, above the form or section it's about: an error is
// announced right away (role="alert"), a success politely (role="status").
defineProps<{ kind: "error" | "success" }>();
</script>

<template>
  <p :role="kind === 'error' ? 'alert' : 'status'" class="banner" :class="`banner--${kind}`">
    <svg
      v-if="kind === 'error'"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true"
      class="mt-0.5 shrink-0"
    >
      <path d="M10 2 1 17h18L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M10 8v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
    <span><slot /></span>
  </p>
</template>
