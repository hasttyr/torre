<script setup lang="ts">
import { useTemplateRef } from "vue";

import { useInView } from "../../lib/useInView";

// One feature on the landing: a glass tile (light, or the dark ink glass)
// with the feature's name, one line on what it does, and an illustration
// of it drawn with sample data. A wide tile spans the page and gets the
// larger type.
withDefaults(defineProps<{ title: string; text: string; surface?: "theme" | "elevated" | "ink"; wide?: boolean }>(), {
  surface: "theme",
  wide: false,
});

const SURFACE_CLASSES = {
  theme: "pane",
  elevated: "pane",
  ink: "pane-ink",
} as const;

// The illustration rises in once most of it is on screen, not the moment
// its top edge peeks in; parts of it can animate along through the
// `group-data-[revealed=false]/render:` variant.
const revealed = useInView(useTemplateRef<HTMLElement>("render"), { rootMargin: "0px 0px -15% 0px" });
</script>

<template>
  <article
    class="flex flex-col items-center overflow-hidden rounded-[28px] px-4 pt-14 pb-12 text-center sm:px-8 sm:pt-20 sm:pb-16 lg:pt-24 lg:pb-20"
    :class="SURFACE_CLASSES[surface]"
  >
    <h3
      class="max-w-3xl leading-[1.04]"
      :class="[
        wide
          ? 'text-[clamp(2.1rem,1.3rem+3vw,3.75rem)] tracking-[-0.04em]'
          : 'text-[clamp(1.75rem,1.35rem+1.5vw,2.625rem)] tracking-[-0.035em]',
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
      class="group/render mt-12 w-full transition duration-700 ease-out select-none data-[revealed=false]:translate-y-8 data-[revealed=false]:opacity-0 sm:mt-12"
      :class="wide ? 'max-w-3xl' : 'max-w-md'"
    >
      <slot />
    </div>
  </article>
</template>
