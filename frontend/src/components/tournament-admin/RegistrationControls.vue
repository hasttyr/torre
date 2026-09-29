<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { showTournament, tournamentQuery } from "../../queries/tournaments";
import { closeRegistration, openRegistration } from "../../services/tournaments";
import FadeSlide from "../ui/FadeSlide.vue";
import FormBanner from "../ui/FormBanner.vue";

const props = defineProps<{ tournamentId: string }>();

const cache = useQueryCache();
const tournament = useQuery(() => tournamentQuery(props.tournamentId));
const status = computed(() => tournament.data.value?.status);
const confirm = useConfirm();
const { t } = useI18n();

// --- HU06: open / close registration ---

const submitting = ref(false);
const error = ref<string | null>(null);

/** Opens registration for the current tournament. */
async function onOpen(): Promise<void> {
  error.value = null;
  submitting.value = true;
  try {
    showTournament(cache, await openRegistration(props.tournamentId));
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("common.genericServerError"));
  } finally {
    submitting.value = false;
  }
}

/** Closes registration for the current tournament, after confirmation: it can't be reopened. */
async function onClose(): Promise<void> {
  const confirmed = await confirm({
    title: t("tournamentAdmin.closeRegistration"),
    message: t("tournamentAdmin.closeRegistrationConfirm"),
    confirmLabel: t("tournamentAdmin.closeRegistration"),
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  error.value = null;
  submitting.value = true;
  try {
    showTournament(cache, await closeRegistration(props.tournamentId));
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("common.genericServerError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="card">
    <h2 class="mb-1 text-lg">{{ t("tournamentAdmin.registrationTitle") }}</h2>
    <p class="mb-4 text-sm">
      {{ t("tournamentAdmin.registrationSubtitle") }}
      <strong class="text-text">{{ t(`estados.${status}`) }}</strong>
    </p>

    <FadeSlide>
      <FormBanner v-if="error" kind="error" class="mb-4">{{ error }}</FormBanner>
    </FadeSlide>

    <div class="flex flex-wrap gap-3">
      <button type="button" class="btn btn-primary" :disabled="submitting || status !== 'CREATED'" @click="onOpen">
        {{ t("tournamentAdmin.openRegistration") }}
      </button>
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="submitting || status !== 'REGISTRATION_OPEN'"
        @click="onClose"
      >
        {{ t("tournamentAdmin.closeRegistration") }}
      </button>
    </div>
  </section>
</template>
