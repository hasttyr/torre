<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { markCoachAccepted, myCoachesQuery, removeMyCoachFromList } from "../../queries/account";
import { useQueryStatus } from "../../queries/status";
import { acceptMyCoach, removeMyCoach, type MyCoach, type PlayerClub } from "../../services/auth";
import LoadError from "../ui/LoadError.vue";
import FormBanner from "../ui/FormBanner.vue";

defineProps<{ club: PlayerClub | null }>();

const { t } = useI18n();
const confirm = useConfirm();

const cache = useQueryCache();
const coachesEntry = useQuery(myCoachesQuery);
const coaches = computed(() => coachesEntry.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(coachesEntry, "account.affiliationsLoadError");
const actionError = ref<string | null>(null);

// HU24: a coach sees the player's progress only once the player accepts.
const requests = computed(() => coaches.value.filter((coach) => coach.acceptedAt === null));
const following = computed(() => coaches.value.filter((coach) => coach.acceptedAt !== null));

/** Accepts a coach's request: from now on they follow the player's progress. */
async function onAccept(coach: MyCoach): Promise<void> {
  actionError.value = null;
  try {
    await acceptMyCoach(coach.id);
    markCoachAccepted(cache, coach.id);
  } catch {
    actionError.value = t("account.coachRequestError");
  }
}

/** Declines a coach's request. Nothing was shared yet, so there's nothing to confirm. */
async function onDecline(coach: MyCoach): Promise<void> {
  actionError.value = null;
  try {
    await removeMyCoach(coach.id);
    removeMyCoachFromList(cache, coach.id);
  } catch {
    actionError.value = t("account.coachRequestError");
  }
}

/** HU24, the player's side: a coach follows their progress only while the player agrees. */
async function onRemove(coach: MyCoach): Promise<void> {
  const confirmed = await confirm({
    title: t("account.removeCoachTitle", { name: coach.name }),
    message: t("account.removeCoachMessage"),
    confirmLabel: t("account.removeCoachConfirm"),
    danger: true,
  });
  if (!confirmed) return;

  actionError.value = null;
  try {
    await removeMyCoach(coach.id);
    removeMyCoachFromList(cache, coach.id);
  } catch {
    actionError.value = t("account.removeCoachError");
  }
}
</script>

<template>
  <section class="card mt-6">
    <h2 class="mb-1 text-lg">{{ t("account.affiliationsTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("account.affiliationsSubtitle") }}</p>

    <LoadError v-if="loadError" :message="loadError" :retry="retry" class="mb-4" />
    <FormBanner v-if="actionError" kind="error" class="mb-4">{{ actionError }}</FormBanner>

    <dl class="m-0">
      <div class="flex justify-between gap-4 border-b border-border-soft py-3">
        <dt class="text-sm text-text-muted">{{ t("account.clubLabel") }}</dt>
        <dd class="m-0 font-semibold">
          {{ club ? club.name : t("account.noClub") }}
        </dd>
      </div>
      <div class="py-3">
        <dt class="mb-2 text-sm text-text-muted">{{ t("account.coachesLabel") }}</dt>
        <dd class="m-0">
          <p v-if="loading" class="text-sm text-text-muted">{{ t("account.coachesLoading") }}</p>
          <p v-else-if="coaches.length === 0" class="text-sm text-text-muted">{{ t("account.noCoaches") }}</p>
          <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
            <li v-for="coach in requests" :key="coach.id" class="flex items-center justify-between gap-3 text-sm">
              <span>
                <span class="font-semibold">{{ coach.name }}</span>
                <span class="text-text-muted">({{ coach.email }})</span>
                {{ t("account.coachRequest") }}
              </span>
              <span class="flex gap-1">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :aria-label="t('account.acceptCoach', { name: coach.name })"
                  @click="onAccept(coach)"
                >
                  {{ t("account.acceptCoachLabel") }}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost text-error"
                  :aria-label="t('account.declineCoach', { name: coach.name })"
                  @click="onDecline(coach)"
                >
                  {{ t("account.declineCoachLabel") }}
                </button>
              </span>
            </li>
            <li v-for="coach in following" :key="coach.id" class="flex items-center justify-between gap-3 text-sm">
              <span class="font-semibold">
                {{ coach.name }}
                <span class="font-normal text-text-muted">({{ coach.email }})</span>
              </span>
              <button
                type="button"
                class="btn btn-ghost text-error"
                :aria-label="t('account.removeCoach', { name: coach.name })"
                @click="onRemove(coach)"
              >
                {{ t("account.removeCoachConfirm") }}
              </button>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  </section>
</template>
