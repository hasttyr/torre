<script setup lang="ts">
// How banners and messages come and go across the app: a short fade with a
// slight slide, one definition instead of the same four classes in every view.
</script>

<template>
  <Transition
    enter-active-class="transition duration-180 ease-out"
    enter-from-class="opacity-0 -translate-y-1.5"
    leave-active-class="transition duration-180 ease-in"
    leave-to-class="opacity-0 -translate-y-1.5"
  >
    <slot />
  </Transition>
</template>
