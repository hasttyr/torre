<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";

// Renders its content only once it comes near the viewport (and keeps it
// from then on): content far down a page doesn't download its code or
// data, nor spend CPU rendering, until the user scrolls toward it. The
// placeholder slot holds its place meanwhile. It emits `visible` the
// moment it decides to render, so the parent can start the content's data
// in parallel with the content's code.
const props = withDefaults(defineProps<{ rootMargin?: string }>(), { rootMargin: "400px" });
const emit = defineEmits<{ visible: [] }>();

const root = useTemplateRef<HTMLElement>("root");
const visible = ref(typeof IntersectionObserver === "undefined");
let observer: IntersectionObserver | undefined;

onMounted(() => {
  if (visible.value) {
    emit("visible");
    return;
  }
  if (!root.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (visible.value || !entries.some((entry) => entry.isIntersecting)) return;
      emit("visible");
      visible.value = true;
      observer?.disconnect();
    },
    { rootMargin: props.rootMargin },
  );
  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="root" class="h-full">
    <slot v-if="visible" />
    <slot v-else name="placeholder" />
  </div>
</template>
