<script setup lang="ts">
import { useI18n } from "vue-i18n";

import type { WidgetKey } from "../../services/dashboard";
import { WIDGET_MIN_HEIGHT } from "./widgetHeights";

// Holds a widget's place while its code loads, or until it scrolls near
// the viewport: the same card with its real title, as tall as the widget at its smallest
// (widgetHeights.ts), so nothing jumps when the widget replaces it.
defineProps<{ widget: WidgetKey }>();

const { t } = useI18n();
</script>

<template>
  <section class="card flex h-full flex-col gap-6" :class="WIDGET_MIN_HEIGHT[widget]" data-test="widget-skeleton">
    <header>
      <h2 class="text-title">{{ t(`widgets.${widget}.title`) }}</h2>
      <p class="mt-1 text-body-sm">{{ t(`widgets.${widget}.description`) }}</p>
    </header>
    <div class="flex flex-col gap-2.5" aria-hidden="true">
      <div class="skeleton h-4 w-2/3" />
      <div class="skeleton h-4 w-full" />
      <div class="skeleton h-4 w-5/6" />
    </div>
  </section>
</template>
