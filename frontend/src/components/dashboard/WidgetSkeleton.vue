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
  <section class="card flex h-full min-h-52 flex-col gap-6" data-test="widget-skeleton">
    <header>
      <h2 class="text-[1.375rem] tracking-[-0.025em]">{{ t(`widgets.${widget}.title`) }}</h2>
      <p class="mt-1 text-[0.95rem]">{{ t(`widgets.${widget}.description`) }}</p>
    </header>
    <div class="flex flex-col gap-2.5" aria-hidden="true">
      <div class="skeleton h-4 w-2/3" />
      <div class="skeleton h-4 w-full" />
      <div class="skeleton h-4 w-5/6" />
    </div>
  </section>
</template>
