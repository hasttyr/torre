<script setup lang="ts">
import { onMounted, reactive, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";

import PlayerAffiliations from "../components/account/PlayerAffiliations.vue";
import PrivacyDataRights from "../components/account/PrivacyDataRights.vue";
import AppHeader from "../components/layout/AppHeader.vue";
import DateField from "../components/ui/DateField.vue";
import { toIsoDate } from "../lib/dates";
import { extractErrorMessage } from "../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid } from "../lib/formErrors";
import { DISABILITIES, GENDERS, type Disability, type Gender } from "../services/auth";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const { t } = useI18n();
const loadError = ref<string | null>(null);
const todayIso = toIsoDate(new Date());

// HU20: form for editing the user's own profile. It gets populated from
// auth.user as soon as it arrives (onMounted and the watch below, in case
// refreshUser resolves after the first render).
const form = reactive({
  name: "",
  universityCode: "",
  program: "",
  semester: "",
  birthDate: "",
  gender: "" as Gender | "",
  disability: "" as Disability | "",
});

/** Fills the edit form from the currently loaded user, if any. */
function populateForm(): void {
  if (!auth.user) return;
  form.name = auth.user.name;
  if (auth.user.player) {
    form.universityCode = auth.user.player.universityCode;
    form.program = auth.user.player.program;
    form.semester = String(auth.user.player.semester);
    // The date input expects "YYYY-MM-DD"; the backend returns a full ISO string.
    form.birthDate = auth.user.player.birthDate?.slice(0, 10) ?? "";
    form.gender = auth.user.player.gender ?? "";
    form.disability = auth.user.player.disability ?? "";
  }
}

watch(() => auth.user, populateForm, { immediate: true });

onMounted(async () => {
  try {
    await auth.refreshUser();
  } catch {
    loadError.value = t("account.loadError");
  }
});

const errors = reactive<Record<string, string>>({});
const formEl = useTemplateRef<HTMLFormElement>("formEl");
const submitting = ref(false);
const successMessage = ref<string | null>(null);
const serverError = ref<string | null>(null);

/**
 * Validates the profile edit form, mirroring
 * backend/src/validators/users.schemas.ts.
 *
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.name.trim().length < 2) {
    errors.name = t("account.nameMinLength");
  }

  if (auth.user?.player) {
    if (!form.universityCode.trim()) {
      errors.universityCode = t("account.universityCodeRequired");
    }
    if (!form.program.trim()) {
      errors.program = t("account.programRequired");
    }
    if (!Number.isInteger(Number(form.semester)) || Number(form.semester) <= 0) {
      errors.semester = t("account.semesterPositive");
    }
    if (form.birthDate && form.birthDate > toIsoDate(new Date())) {
      errors.birthDate = t("account.birthDateInFuture");
    }
  }

  return Object.keys(errors).length === 0;
}

/** Validates and submits the profile edit form to the backend. */
async function onSubmit(): Promise<void> {
  successMessage.value = null;
  serverError.value = null;

  if (!validate()) {
    await focusFirstInvalid(formEl.value);
    return;
  }

  submitting.value = true;
  try {
    await auth.updateProfile({
      name: form.name.trim(),
      ...(auth.user?.player
        ? {
            universityCode: form.universityCode.trim(),
            program: form.program.trim(),
            semester: Number(form.semester),
            birthDate: form.birthDate || null,
            gender: form.gender || null,
            disability: form.disability || null,
          }
        : {}),
    });
    successMessage.value = t("account.successMessage");
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("account.genericServerError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container max-w-xl py-10 sm:py-12">
      <h1 class="text-2xl sm:text-3xl">{{ t("account.title") }}</h1>

      <p v-if="loadError" role="alert" class="banner banner--error mt-4">{{ loadError }}</p>

      <section v-if="auth.user" class="card mt-6">
        <dl class="m-0">
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">{{ t("account.email") }}</dt>
            <dd class="m-0 font-semibold">{{ auth.user.email }}</dd>
          </div>
          <div class="flex justify-between gap-4 border-b border-border-soft py-3">
            <dt class="text-sm text-text-muted">{{ t("account.role") }}</dt>
            <dd class="m-0 font-semibold">{{ t(`roles.${auth.user.role}`) }}</dd>
          </div>
          <div class="flex justify-between gap-4 py-3">
            <dt class="text-sm text-text-muted">{{ t("account.status") }}</dt>
            <dd class="m-0 font-semibold">
              {{ auth.user.status === "ACTIVE" ? t("account.active") : t("account.inactive") }}
            </dd>
          </div>
        </dl>
      </section>

      <section v-if="auth.user" class="card mt-6">
        <h2 class="mb-1 text-lg">{{ t("account.editProfileTitle") }}</h2>
        <p class="mb-4 text-sm">{{ t("account.editProfileHint") }}</p>

        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="successMessage" class="banner banner--success mb-4">{{ successMessage }}</p>
        </Transition>
        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="serverError" role="alert" class="banner banner--error mb-4">{{ serverError }}</p>
        </Transition>

        <form ref="formEl" novalidate class="flex flex-col gap-4" @submit.prevent="onSubmit">
          <div class="field" :class="{ 'has-error': errors.name }">
            <label for="name">{{ t("account.nameLabel") }}</label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              name="name"
              autocomplete="name"
              v-bind="errorAttrs(errors, 'name')"
            />
            <span :id="errorId('name')" class="field-error">{{ errors.name }}</span>
          </div>

          <template v-if="auth.user.player">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field" :class="{ 'has-error': errors.universityCode }">
                <label for="universityCode">{{ t("account.universityCodeLabel") }}</label>
                <input
                  id="universityCode"
                  v-model="form.universityCode"
                  type="text"
                  name="universityCode"
                  autocomplete="off"
                  spellcheck="false"
                  v-bind="errorAttrs(errors, 'universityCode')"
                />
                <span :id="errorId('universityCode')" class="field-error">{{ errors.universityCode }}</span>
              </div>
              <div class="field" :class="{ 'has-error': errors.semester }">
                <label for="semester">{{ t("account.semesterLabel") }}</label>
                <input
                  id="semester"
                  v-model="form.semester"
                  type="number"
                  name="semester"
                  autocomplete="off"
                  min="1"
                  v-bind="errorAttrs(errors, 'semester')"
                />
                <span :id="errorId('semester')" class="field-error">{{ errors.semester }}</span>
              </div>
            </div>
            <div class="field" :class="{ 'has-error': errors.program }">
              <label for="program">{{ t("account.programLabel") }}</label>
              <input
                id="program"
                v-model="form.program"
                type="text"
                name="program"
                autocomplete="off"
                v-bind="errorAttrs(errors, 'program')"
              />
              <span :id="errorId('program')" class="field-error">{{ errors.program }}</span>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="field" :class="{ 'has-error': errors.birthDate }">
                <label for="birthDate">{{ t("account.birthDateLabel") }}</label>
                <DateField
                  id="birthDate"
                  v-model="form.birthDate"
                  :max-date="todayIso"
                  :invalid="Boolean(errors.birthDate)"
                />
                <span :id="errorId('birthDate')" class="field-error">{{ errors.birthDate }}</span>
                <span v-if="auth.user.player.age != null" class="text-sm text-text-muted">
                  {{ t("account.currentAge", { age: auth.user.player.age }) }}
                </span>
              </div>
              <div class="field">
                <label for="gender">{{ t("account.genderLabel") }}</label>
                <select id="gender" v-model="form.gender" name="gender">
                  <option value="">{{ t("account.genderPreferNotToSay") }}</option>
                  <option v-for="option in GENDERS" :key="option" :value="option">{{ t(`genero.${option}`) }}</option>
                </select>
              </div>
            </div>

            <div class="field">
              <label for="disability">{{ t("account.disabilityLabel") }}</label>
              <select id="disability" v-model="form.disability" name="disability">
                <option value="">{{ t("account.disabilityNotSpecified") }}</option>
                <option v-for="option in DISABILITIES" :key="option" :value="option">
                  {{ t(`discapacidad.${option}`) }}
                </option>
              </select>
            </div>
          </template>

          <button type="submit" class="btn btn-primary self-start" :disabled="submitting">
            {{ submitting ? t("account.saving") : t("account.saveButton") }}
          </button>
        </form>
      </section>

      <PlayerAffiliations v-if="auth.user?.player" :club="auth.user.player.club" />

      <PrivacyDataRights v-if="auth.user" />
    </main>
  </div>
</template>
