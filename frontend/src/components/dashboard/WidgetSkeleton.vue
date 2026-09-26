<script setup lang="ts">
import { useI18n } from "vue-i18n";

import type { WidgetKey } from "../../services/dashboard";

// Holds a widget's place while its code loads, or until it scrolls near
// the viewport: the same card with its real title, so nothing jumps when
// the widget replaces it.
defineProps<{ widget: WidgetKey }>();

const { t } = useI18n();
</script>

<template>
  <section class="card flex h-full min-h-52 flex-col gap-4" data-test="widget-skeleton">
    <header>
      <h2 class="text-lg">{{ t(`widgets.${widget}.title`) }}</h2>
      <p class="mt-0.5 text-sm">{{ t(`widgets.${widget}.description`) }}</p>
    </header>
    <div class="flex flex-col gap-2.5" aria-hidden="true">
      <div class="h-4 w-2/3 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div class="h-4 w-full animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
      <div class="h-4 w-5/6 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
    </div>
  </section>
</template>
