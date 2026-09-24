<script setup lang="ts">
import { useI18n } from "vue-i18n";

import type { WidgetKey } from "../../services/dashboard";

// The frame every dashboard widget renders in: title, description and the
// loading / error / empty states, so each widget only writes its content.
defineProps<{
  widget: WidgetKey;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage?: string;
  // Player widgets: whose data this is, shown as a pill next to the title.
  subjectName?: string | null;
}>();

defineEmits<{ retry: [] }>();

const { t } = useI18n();
</script>

<template>
  <section class="card flex h-full flex-col gap-4" :aria-busy="loading">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-lg">{{ t(`widgets.${widget}.title`) }}</h2>
        <p class="mt-0.5 text-sm">{{ t(`widgets.${widget}.description`) }}</p>
      </div>
      <span v-if="subjectName" class="pill max-w-[45%] truncate">{{ subjectName }}</span>
    </header>

    <div v-if="loading" class="flex flex-col gap-2.5" data-test="widget-loading">
      <span class="sr-only">{{ t("panel.loadingWidget") }}</span>
      <div class="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
      <div class="h-4 w-full animate-pulse rounded bg-surface-2" />
      <div class="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
    </div>

    <div v-else-if="error" role="alert" class="banner banner--error items-center justify-between">
      <span>{{ error }}</span>
      <button type="button" class="font-semibold underline" @click="$emit('retry')">{{ t("panel.retry") }}</button>
    </div>

    <p
      v-else-if="empty"
      class="rounded-2xl border border-dashed border-border-soft p-6 text-center text-sm text-text-muted"
    >
      {{ emptyMessage ?? t("panel.widgetEmpty") }}
    </p>

    <div v-else class="min-w-0 flex-1">
      <slot />
    </div>
  </section>
</template>
