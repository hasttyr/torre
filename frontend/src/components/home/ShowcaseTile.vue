<script setup lang="ts">
import { useTemplateRef } from "vue";

import { useInView } from "../../lib/useInView";

// One feature on the landing: a tile with square edges (the change of
// surface between tiles is the divider), the feature's name, one line on
// what it does, and an illustration of it drawn with sample data. A wide
// tile spans the page and gets the larger type.
withDefaults(defineProps<{ title: string; text: string; surface?: "theme" | "elevated" | "ink"; wide?: boolean }>(), {
  surface: "theme",
  wide: false,
});

const SURFACE_CLASSES = {
  theme: "bg-bg",
  elevated: "bg-bg-elevated",
  ink: "bg-tile-ink",
} as const;

// The illustration rises in once most of it is on screen, not the moment
// its top edge peeks in; parts of it can animate along through the
// `group-data-[revealed=false]/render:` variant.
const revealed = useInView(useTemplateRef<HTMLElement>("render"), { rootMargin: "0px 0px -15% 0px" });
</script>

<template>
  <article
    class="flex flex-col items-center overflow-hidden px-4 py-12 text-center sm:px-8 sm:py-16 lg:py-20"
    :class="SURFACE_CLASSES[surface]"
  >
    <h3
      class="max-w-2xl tracking-[-0.02em]"
      :class="[
        wide ? 'text-[clamp(1.9rem,1.35rem+2.4vw,3.1rem)]' : 'text-[clamp(1.6rem,1.3rem+1.3vw,2.3rem)]',
        { 'text-tile-ink-text': surface === 'ink' },
      ]"
    >
      {{ title }}
    </h3>
    <p
      class="mt-3 text-pretty"
      :class="[
        wide ? 'max-w-xl text-[clamp(1.05rem,0.95rem+0.45vw,1.3rem)]' : 'max-w-md text-base sm:text-[1.0625rem]',
        { 'text-tile-ink-muted': surface === 'ink' },
      ]"
    >
      {{ text }}
    </p>
    <div
      ref="render"
      data-render
      aria-hidden="true"
      :data-revealed="revealed"
      class="group/render mt-10 w-full transition duration-700 ease-out select-none data-[revealed=false]:translate-y-8 data-[revealed=false]:opacity-0 sm:mt-12"
      :class="wide ? 'max-w-3xl' : 'max-w-md'"
    >
      <slot />
    </div>
  </article>
</template>
