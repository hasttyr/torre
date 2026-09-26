<script setup lang="ts">
import { reactive, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import AppHeader from "../../components/layout/AppHeader.vue";
import DateField from "../../components/ui/DateField.vue";
import { extractErrorMessage } from "../../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid } from "../../lib/formErrors";
import { hasChanges, useUnsavedChangesGuard } from "../../lib/unsavedChanges";
import { useTournamentsStore } from "../../stores/tournaments";

const router = useRouter();
const tournaments = useTournamentsStore();
const { t } = useI18n();

const EMPTY_FORM = { name: "", startDate: "", endDate: "", format: "swiss" };
const form = reactive({ ...EMPTY_FORM });

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const serverError = ref<string | null>(null);
const formEl = useTemplateRef<HTMLFormElement>("formEl");

// Once created, the form's data lives in the tournament: leaving is safe.
const created = ref(false);
useUnsavedChangesGuard(() => !created.value && hasChanges(form, EMPTY_FORM));

/**
 * Validates the tournament creation form, mirroring
 * backend/src/validators/tournaments.schemas.ts.
 *
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.name.trim().length < 2) {
    errors.name = t("createTournament.nameMinLength");
  }
  if (!form.startDate) {
    errors.startDate = t("createTournament.startDateRequired");
  }
  if (!form.endDate) {
    errors.endDate = t("createTournament.endDateRequired");
  }
  if (form.startDate && form.endDate && form.endDate < form.startDate) {
    errors.endDate = t("createTournament.endDateBeforeStart");
  }

  return Object.keys(errors).length === 0;
}

/** Validates and submits the tournament creation form to the backend. */
async function onSubmit(): Promise<void> {
  serverError.value = null;

  if (!validate()) {
    await focusFirstInvalid(formEl.value);
    return;
  }

  submitting.value = true;
  try {
    const tournament = await tournaments.create({
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      format: form.format.trim() || undefined,
    });
    created.value = true;
    router.push(`/torneos/${tournament.id}`);
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("auth.serverError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container max-w-lg py-10 sm:py-12">
      <h1 class="text-2xl sm:text-3xl">{{ t("createTournament.title") }}</h1>
      <p class="mt-1">{{ t("createTournament.subtitle") }}</p>

      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <p v-if="serverError" role="alert" class="banner banner--error mt-4">{{ serverError }}</p>
      </Transition>

      <form ref="formEl" novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="field" :class="{ 'has-error': errors.name }">
          <label for="name">{{ t("createTournament.nameLabel") }}</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            name="name"
            autocomplete="off"
            :placeholder="t('createTournament.namePlaceholder')"
            v-bind="errorAttrs(errors, 'name')"
          />
          <span :id="errorId('name')" class="field-error">{{ errors.name }}</span>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="field" :class="{ 'has-error': errors.startDate }">
            <label for="startDate">{{ t("createTournament.startDateLabel") }}</label>
            <DateField id="startDate" v-model="form.startDate" :invalid="Boolean(errors.startDate)" />
            <span :id="errorId('startDate')" class="field-error">{{ errors.startDate }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.endDate }">
            <label for="endDate">{{ t("createTournament.endDateLabel") }}</label>
            <DateField id="endDate" v-model="form.endDate" :invalid="Boolean(errors.endDate)" />
            <span :id="errorId('endDate')" class="field-error">{{ errors.endDate }}</span>
          </div>
        </div>

        <div class="field">
          <label for="format">{{ t("createTournament.formatLabel") }}</label>
          <input
            id="format"
            v-model="form.format"
            type="text"
            name="format"
            autocomplete="off"
            :placeholder="t('createTournament.formatPlaceholder')"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
          {{ submitting ? t("createTournament.submitting") : t("createTournament.submit") }}
        </button>
      </form>
    </main>
  </div>
</template>
