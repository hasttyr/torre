<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { useLocaleStore } from "../../stores/locale";

const locale = useLocaleStore();
const { t } = useI18n();
</script>

<template>
  <span class="relative inline-flex">
    <button
      type="button"
      class="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-text/6 px-2 text-xs font-semibold text-text transition-[background-color,scale] hover:bg-text/12 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      :aria-label="locale.locale === 'es' ? t('locale.switchToEnglish') : t('locale.switchToSpanish')"
      :title="locale.locale === 'es' ? t('locale.switchToEnglish') : t('locale.switchToSpanish')"
      @click="locale.toggle()"
    >
      {{ locale.locale.toUpperCase() }}
    </button>
    <span
      v-if="locale.switchFailed"
      role="alert"
      class="absolute top-full right-0 z-20 mt-2 w-max max-w-60 rounded-xl bg-bg-elevated px-3 py-2 text-xs text-text shadow-lg ring-1 ring-text/8"
    >
      {{ t("locale.switchFailed") }}
    </span>
  </span>
</template>
