<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { useTournamentsStore } from "../../stores/tournaments";

const props = defineProps<{ tournamentId: string }>();

const tournaments = useTournamentsStore();
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
    await tournaments.openRegistration(props.tournamentId);
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("tournamentAdmin.genericServerError"));
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
    await tournaments.closeRegistration(props.tournamentId);
  } catch (submitError) {
    error.value = extractErrorMessage(submitError, t("tournamentAdmin.genericServerError"));
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
      <strong class="text-text">{{ t(`estados.${tournaments.current?.status}`) }}</strong>
    </p>

    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 -translate-y-1.5"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0 -translate-y-1.5"
    >
      <p v-if="error" role="alert" class="banner banner--error mb-4">{{ error }}</p>
    </Transition>

    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="submitting || tournaments.current?.status !== 'CREATED'"
        @click="onOpen"
      >
        {{ t("tournamentAdmin.openRegistration") }}
      </button>
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="submitting || tournaments.current?.status !== 'REGISTRATION_OPEN'"
        @click="onClose"
      >
        {{ t("tournamentAdmin.closeRegistration") }}
      </button>
    </div>
  </section>
</template>
