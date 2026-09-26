<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { formatNumericDate, fromIsoDate } from "../../lib/dates";
import { useLocaleStore } from "../../stores/locale";

// What DateField shows for the moment the real picker takes to download:
// the same input (id, look, calendar icon, the date already formatted),
// read-only until the picker replaces it.
defineOptions({ inheritAttrs: false });

const props = defineProps<{ id: string; modelValue?: string; placeholder?: string; invalid?: boolean }>();

const { t } = useI18n();
const locale = useLocaleStore();

const shown = computed(() => (props.modelValue ? formatNumericDate(fromIsoDate(props.modelValue), locale.locale) : ""));
</script>

<template>
  <div class="relative">
    <svg
      class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" stroke-width="1.75" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </svg>
    <input
      :id="id"
      :name="id"
      class="dp__input w-full"
      readonly
      autocomplete="off"
      :value="shown"
      :placeholder="placeholder ?? t('dateField.placeholder')"
      :aria-invalid="invalid ? 'true' : undefined"
    />
  </div>
</template>
