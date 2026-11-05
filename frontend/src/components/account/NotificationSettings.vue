<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { notificationSettingsQuery } from "../../queries/account";
import { useQueryStatus } from "../../queries/status";
import { updateNotificationSettings } from "../../services/auth";
import FormBanner from "../ui/FormBanner.vue";
import LoadError from "../ui/LoadError.vue";

// #141: a player chooses whether to get an email when a round of a
// tournament they play is published. When the deployment has no mail
// provider, it says the notices aren't going out: a notice the player
// counts on and never gets is worse than none.
const { t } = useI18n();
const cache = useQueryCache();

const entry = useQuery(notificationSettingsQuery);
const settings = computed(() => entry.data.value ?? null);
const { loadError, retry } = useQueryStatus(entry, "account.notifications.loadError");
const saving = ref(false);
const saveError = ref(false);

async function onToggle(event: Event): Promise<void> {
  const wanted = (event.target as HTMLInputElement).checked;
  saving.value = true;
  saveError.value = false;
  try {
    cache.setQueryData(notificationSettingsQuery.key, await updateNotificationSettings(wanted));
  } catch {
    saveError.value = true;
    // Back to what the server has: the box mustn't show a choice that wasn't saved.
    (event.target as HTMLInputElement).checked = !wanted;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="card mt-6" aria-labelledby="notifications-heading">
    <h2 id="notifications-heading" class="mb-1 text-lg">{{ t("account.notifications.title") }}</h2>

    <LoadError v-if="loadError" :message="loadError" :retry="retry" />

    <template v-else-if="settings">
      <p v-if="!settings.emailAvailable" class="banner mb-4 border-border bg-surface-2 text-text-muted" role="status">
        {{ t("account.notifications.unavailable") }}
      </p>
      <FormBanner v-if="saveError" kind="error" class="mb-4">{{ t("account.notifications.saveError") }}</FormBanner>

      <label class="flex cursor-pointer items-start gap-2 text-sm font-normal">
        <input
          type="checkbox"
          name="roundPublished"
          class="mt-0.5"
          :checked="settings.roundPublished"
          :disabled="saving"
          @change="onToggle"
        />
        <span>{{ t("account.notifications.roundPublished") }}</span>
      </label>
      <p class="mt-2 text-sm text-text-muted">{{ t("account.notifications.hint") }}</p>
    </template>
  </section>
</template>
