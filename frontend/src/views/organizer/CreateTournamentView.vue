<script setup lang="ts">
import { useQueryCache } from "@pinia/colada";
import { reactive, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import AppHeader from "../../components/layout/AppHeader.vue";
import DateField from "../../components/ui/DateField.vue";
import { extractErrorMessage } from "../../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid, resetErrors } from "../../lib/formErrors";
import { hasChanges, useUnsavedChangesGuard } from "../../lib/unsavedChanges";
import { showTournament } from "../../queries/tournaments";
import { createTournament } from "../../services/tournaments";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";

const router = useRouter();
const cache = useQueryCache();
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
  resetErrors(errors);

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
    const tournament = await createTournament({
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      format: form.format.trim() || undefined,
    });
    // Its admin page opens next: it's already in the cache.
    showTournament(cache, tournament);
    created.value = true;
    router.push(`/torneos/${tournament.id}`);
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("common.genericServerError"));
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

      <FadeSlide>
        <FormBanner v-if="serverError" kind="error" class="mt-4">{{ serverError }}</FormBanner>
      </FadeSlide>

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
