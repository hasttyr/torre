<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { useLocaleStore } from "../stores/locale";

const locale = useLocaleStore();
const { t } = useI18n();
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-border px-2 text-xs font-semibold text-text transition-colors hover:border-accent/40 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    :aria-label="locale.locale === 'es' ? t('locale.switchToEnglish') : t('locale.switchToSpanish')"
    :title="locale.locale === 'es' ? t('locale.switchToEnglish') : t('locale.switchToSpanish')"
    @click="locale.toggle()"
  >
    {{ locale.locale.toUpperCase() }}
  </button>
</template>
