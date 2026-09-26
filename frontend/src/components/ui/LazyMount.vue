<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue";

import { useInView } from "../../lib/useInView";

// Renders its content only once it comes near the viewport (and keeps it
// from then on): content far down a page doesn't download its code or
// data, nor spend CPU rendering, until the user scrolls toward it. The
// placeholder slot holds its place meanwhile. It emits `visible` the
// moment it decides to render, so the parent can start the content's data
// in parallel with the content's code.
const props = withDefaults(defineProps<{ rootMargin?: string }>(), { rootMargin: "400px" });
const emit = defineEmits<{ visible: [] }>();

const visible = useInView(useTemplateRef<HTMLElement>("root"), { rootMargin: props.rootMargin });

// Visible from the start (no IntersectionObserver) never changes, so it's
// announced on mount; otherwise, the moment it flips (sync, not on the next
// tick, so the parent's data request starts right then).
onMounted(() => {
  if (visible.value) emit("visible");
});
watch(visible, () => emit("visible"), { flush: "sync" });
</script>

<template>
  <div ref="root" class="h-full">
    <slot v-if="visible" />
    <slot v-else name="placeholder" />
  </div>
</template>
