<script setup lang="ts">
import { useInfiniteQuery } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton.vue";
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
  <div class="min-h-dvh">
    <AppHeader />

    <main class="container flex max-w-3xl flex-col gap-8 pt-12 pb-20 sm:pt-16 sm:pb-28">
      <div>
        <h1 class="page-title">{{ t("auditLog.title") }}</h1>
        <p class="mt-3">{{ t("auditLog.subtitle") }}</p>
      </div>

      <LoadingSkeleton v-if="loading" :label="t('auditLog.loading')" variant="rows" :count="5" />
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <p v-else-if="logs.length === 0" class="empty-state">
        {{ t("auditLog.empty") }}
      </p>

      <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="log in logs" :key="log.id" class="flex flex-col gap-1 rounded-[22px] pane p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="pill">{{ actionLabel(log.action) }}</span>
            <span class="text-sm text-text-muted">{{ formatFullDateTime(log.createdAt, locale.locale) }}</span>
          </div>
          <p class="text-sm">
            <!-- No user: the system acted on its own (a tournament closed by date). -->
            <strong>{{ log.userName ?? t("auditLog.system") }}</strong>
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
