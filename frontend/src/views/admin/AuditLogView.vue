<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { extractErrorMessage } from "../../lib/errors";
import { listAuditLogs, type AuditLogEntry } from "../../services/auditLogs";
import { useLocaleStore } from "../../stores/locale";

const locale = useLocaleStore();
const { t, te } = useI18n();

const logs = ref<AuditLogEntry[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

// The log only grows: the newest page first, older ones on demand.
const nextCursor = ref<string | null>(null);
const loadingMore = ref(false);
const loadMoreError = ref<string | null>(null);

onMounted(async () => {
  try {
    const page = await listAuditLogs();
    logs.value = page.entries;
    nextCursor.value = page.nextCursor;
  } catch (error) {
    loadError.value = extractErrorMessage(error, t("auditLog.loadError"));
  } finally {
    loading.value = false;
  }
});

/** Appends the next older page; on failure keeps what's shown, so the same page can be retried. */
async function loadMore(): Promise<void> {
  if (!nextCursor.value) return;
  loadingMore.value = true;
  loadMoreError.value = null;
  try {
    const page = await listAuditLogs(nextCursor.value);
    logs.value = [...logs.value, ...page.entries];
    nextCursor.value = page.nextCursor;
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

/** Formats an ISO date string using the active locale, including the time. */
function formatDate(date: string): string {
  return new Date(date).toLocaleString(locale.locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      <LoadError v-else-if="loadError" :message="loadError" />

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
            <span class="text-sm text-text-muted">{{ formatDate(log.createdAt) }}</span>
          </div>
          <p class="text-sm">
            <strong>{{ log.userName }}</strong>
            <span v-if="log.detail"> - {{ log.detail }}</span>
          </p>
        </li>
      </ul>

      <template v-if="nextCursor">
        <p v-if="loadMoreError" role="alert" class="banner banner--error">{{ loadMoreError }}</p>
        <button type="button" class="btn btn-ghost self-center" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? t("auditLog.loadingMore") : t("auditLog.loadMore") }}
        </button>
      </template>
    </main>
  </div>
</template>
