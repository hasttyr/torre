<script setup lang="ts">
import { useInfiniteQuery } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { extractErrorMessage } from "../../lib/errors";
import { formatFullDateTime } from "../../lib/format";
import { auditLogQuery } from "../../queries/admin";
import { useLocaleStore } from "../../stores/locale";
import FormBanner from "../../components/ui/FormBanner.vue";

const locale = useLocaleStore();
const { t, te } = useI18n();

// The log only grows: the newest page first, older ones on demand.
const log = useInfiniteQuery(auditLogQuery);
const logs = computed(() => log.data.value?.pages.flatMap((page) => page.entries) ?? []);
const loading = computed(() => log.status.value === "pending");
// Only for the first page: a failed older page keeps what's shown (loadMoreError).
const loadError = computed(() =>
  log.status.value === "error" && logs.value.length === 0
    ? extractErrorMessage(log.error.value, t("auditLog.loadError"))
    : null,
);
const retry = () => log.refetch();
const hasOlderEntries = computed(() => log.hasNextPage.value);

const loadingMore = ref(false);
const loadMoreError = ref<string | null>(null);

/** Appends the next older page; on failure keeps what's shown, so the same page can be retried. */
async function loadMore(): Promise<void> {
  if (!hasOlderEntries.value) return;
  loadingMore.value = true;
  loadMoreError.value = null;
  try {
    await log.loadNextPage({ throwOnError: true });
  } catch (error) {
    loadMoreError.value = extractErrorMessage(error, t("auditLog.loadError"));
  } finally {
    loadingMore.value = false;
  }
}

/** Falls back to the raw action code if no translation exists yet for it. */
function actionLabel(action: string): string {
  const key = `auditLog.actions.${action}`;
  return te(key) ? t(key) : action;
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-3xl flex-col gap-6 py-10 sm:py-12">
      <div>
        <h1 class="text-2xl sm:text-3xl">{{ t("auditLog.title") }}</h1>
        <p class="mt-1 text-sm">{{ t("auditLog.subtitle") }}</p>
      </div>

      <p v-if="loading">{{ t("auditLog.loading") }}</p>
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <p
        v-else-if="logs.length === 0"
        class="rounded-3xl border border-dashed border-border-soft bg-surface p-8 text-center text-text-muted"
      >
        {{ t("auditLog.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
        <li
          v-for="log in logs"
          :key="log.id"
          class="flex flex-col gap-1 rounded-2xl border border-border-soft bg-surface p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="pill">{{ actionLabel(log.action) }}</span>
            <span class="text-sm text-text-muted">{{ formatFullDateTime(log.createdAt, locale.locale) }}</span>
          </div>
          <p class="text-sm">
            <strong>{{ log.userName }}</strong>
            <span v-if="log.detail"> - {{ log.detail }}</span>
          </p>
        </li>
      </ul>

      <template v-if="hasOlderEntries">
        <FormBanner v-if="loadMoreError" kind="error">{{ loadMoreError }}</FormBanner>
        <button type="button" class="btn btn-ghost self-center" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? t("auditLog.loadingMore") : t("auditLog.loadMore") }}
        </button>
      </template>
    </main>
  </div>
</template>
