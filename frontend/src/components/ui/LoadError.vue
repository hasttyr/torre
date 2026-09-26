<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { reloadPage } from "../../lib/pageLoad";

// A page or section whose data couldn't load: what failed, and the way
// forward. By default retrying reloads the page, which loses nothing: the
// data never arrived. A view with its own way to load again can pass it.
const props = withDefaults(defineProps<{ message: string; retry?: () => unknown }>(), {
  // A function prop's default is the function itself, not a factory.
  retry: reloadPage,
});

const { t } = useI18n();
</script>

<template>
  <div role="alert" class="banner banner--error flex-wrap items-center justify-between">
    <span>{{ message }}</span>
    <button type="button" class="btn btn-ghost px-3 py-1.5 text-sm" @click="props.retry()">
      {{ t("common.retry") }}
    </button>
  </div>
</template>
