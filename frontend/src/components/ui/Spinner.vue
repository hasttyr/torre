<script setup lang="ts">
// A small busy indicator for a button's label while its action runs. Purely
// visual: the button's own text says what's happening.
</script>

<template>
  <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
  </svg>
</template>
