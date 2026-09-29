<script setup lang="ts">
import { computed, reactive, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import AuthLayout from "../../components/layout/AuthLayout.vue";
import { extractErrorMessage, fieldErrorsOf } from "../../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid, resetErrors } from "../../lib/formErrors";
import { HOME_PATH } from "../../lib/roleHome";
import {
  registerUser,
  SELF_ASSIGNABLE_ROLES,
  type RegisterPayload,
  type SelfAssignableRole,
} from "../../services/auth";
import { useAuthStore } from "../../stores/auth";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";
import Spinner from "../../components/ui/Spinner.vue";

const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

const ROLE_GLYPHS: Record<SelfAssignableRole, string> = {
  PLAYER: "♙",
  COACH: "♗",
};

const form = reactive({
  name: "",
  email: "",
  password: "",
  role: "PLAYER" as SelfAssignableRole,
  universityCode: "",
  program: "",
  semester: "",
  acceptDataPolicy: false,
});

const isPlayer = computed(() => form.role === "PLAYER");

/**
 * Checks whether a string has the basic shape of an email address.
 *
 * @remarks
 * No regex on purpose: it avoids the backtracking pattern security linters
 * flag. The authoritative validation is always the backend's.
 */
function looksLikeEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) {
    return false;
  }
  const domain = value.slice(at + 1);
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1 && !domain.includes(" ");
}

const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const serverError = ref<string | null>(null);
const formEl = useTemplateRef<HTMLFormElement>("formEl");

/**
 * Validates the registration form, mirroring
 * backend/src/validators/auth.schemas.ts.
 *
 * @remarks This is UX validation (immediate feedback); the validation that
 * ultimately decides is always the backend's.
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  resetErrors(errors);

  if (form.name.trim().length < 2) {
    errors.name = t("auth.nameMinLength");
  }
  if (!looksLikeEmail(form.email.trim())) {
    errors.email = t("auth.emailInvalid");
  }
  if (form.password.length < 8) {
    errors.password = t("auth.passwordMinLength");
  }

  if (isPlayer.value) {
    if (!form.universityCode.trim()) {
      errors.universityCode = t("auth.universityCodeRequired");
    }
    if (!form.program.trim()) {
      errors.program = t("auth.programRequired");
    }
    if (!Number.isInteger(Number(form.semester)) || Number(form.semester) <= 0) {
      errors.semester = t("auth.semesterPositive");
    }
  }

  // RN-10/HU21: el registro no se completa sin esta aceptación explícita.
  if (!form.acceptDataPolicy) {
    errors.acceptDataPolicy = t("register.acceptDataPolicyRequired");
  }

  return Object.keys(errors).length === 0;
}

/** Builds the registration API payload from the form, shaped by the chosen role. */
function buildPayload(): RegisterPayload {
  const base = {
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    // Garantizado `true` por validate(): el submit se detiene si no lo está.
    acceptDataPolicy: true as const,
  };

  if (form.role === "PLAYER") {
    return {
      ...base,
      role: "PLAYER",
      universityCode: form.universityCode.trim(),
      program: form.program.trim(),
      semester: Number(form.semester),
    };
  }

  return { ...base, role: form.role };
}

/** Validates and submits the registration form to the backend, then logs in and redirects. */
async function onSubmit(): Promise<void> {
  serverError.value = null;

  if (!validate()) {
    await focusFirstInvalid(formEl.value);
    return;
  }

  submitting.value = true;
  try {
    await registerUser(buildPayload());
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("common.genericServerError"));
    // The API's field paths are this form's field ids: its objections go next to each field.
    Object.assign(errors, fieldErrorsOf(error));
    submitting.value = false;
    await focusFirstInvalid(formEl.value);
    return;
  }

  // Registration alone doesn't issue a session token; logging in right after
  // with the same credentials gets the user in without a second manual step.
  // If that fails (a dropped connection, a rate limit), the account exists
  // anyway: the login page says so, instead of an error here that a retry
  // would only turn into "that email is already registered".
  try {
    await auth.login(form.email.trim(), form.password);
    router.push(HOME_PATH);
  } catch {
    router.push({ path: "/login", query: { registered: "1" } });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('register.title')" :subtitle="t('register.subtitle')">
    <template #banners>
      <FadeSlide>
        <FormBanner v-if="serverError" kind="error">{{ serverError }}</FormBanner>
      </FadeSlide>
    </template>

    <form ref="formEl" novalidate @submit.prevent="onSubmit">
      <div class="field">
        <span class="field-label">{{ t("register.roleLabel") }}</span>
        <div class="grid grid-cols-2 gap-2.5" role="radiogroup" :aria-label="t('register.roleLabel')">
          <label
            v-for="role in SELF_ASSIGNABLE_ROLES"
            :key="role"
            class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center text-[0.78rem] font-semibold transition-colors"
            :class="
              form.role === role
                ? 'border-accent bg-accent/15 text-text'
                : 'border-border bg-surface-2 text-text-muted hover:border-accent/40'
            "
          >
            <input v-model="form.role" type="radio" name="role" :value="role" class="sr-only" />
            <span class="text-xl text-accent" aria-hidden="true">{{ ROLE_GLYPHS[role] }}</span>
            <span>{{ t(`roles.${role}`) }}</span>
          </label>
        </div>
      </div>

      <div class="field" :class="{ 'has-error': errors.name }">
        <label for="name">{{ t("register.nameLabel") }}</label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          name="name"
          autocomplete="name"
          :placeholder="t('register.namePlaceholder')"
          v-bind="errorAttrs(errors, 'name')"
        />
        <span :id="errorId('name')" class="field-error">{{ errors.name }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">{{ t("auth.email") }}</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          name="email"
          autocomplete="email"
          spellcheck="false"
          :placeholder="t('register.emailPlaceholder')"
          v-bind="errorAttrs(errors, 'email')"
        />
        <span :id="errorId('email')" class="field-error">{{ errors.email }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.password }">
        <label for="password">{{ t("auth.password") }}</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          name="password"
          autocomplete="new-password"
          :placeholder="t('register.passwordPlaceholder')"
          v-bind="errorAttrs(errors, 'password')"
        />
        <span :id="errorId('password')" class="field-error">{{ errors.password }}</span>
      </div>

      <FadeSlide>
        <fieldset
          v-if="isPlayer"
          class="m-0 flex flex-col gap-4 rounded-xl border border-dashed border-border p-4 pt-4"
        >
          <legend class="px-1.5 text-[0.8rem] font-semibold text-text-muted">
            {{ t("register.playerDataLegend") }}
          </legend>

          <div class="field" :class="{ 'has-error': errors.universityCode }">
            <label for="universityCode">{{ t("register.universityCodeLabel") }}</label>
            <input
              id="universityCode"
              v-model="form.universityCode"
              type="text"
              name="universityCode"
              autocomplete="off"
              spellcheck="false"
              :placeholder="t('register.universityCodePlaceholder')"
              v-bind="errorAttrs(errors, 'universityCode')"
            />
            <span :id="errorId('universityCode')" class="field-error">{{ errors.universityCode }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.program }">
            <label for="program">{{ t("register.programLabel") }}</label>
            <input
              id="program"
              v-model="form.program"
              type="text"
              name="program"
              autocomplete="off"
              :placeholder="t('register.programPlaceholder')"
              v-bind="errorAttrs(errors, 'program')"
            />
            <span :id="errorId('program')" class="field-error">{{ errors.program }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.semester }">
            <label for="semester">{{ t("register.semesterLabel") }}</label>
            <input
              id="semester"
              v-model="form.semester"
              type="number"
              name="semester"
              autocomplete="off"
              min="1"
              :placeholder="t('register.semesterPlaceholder')"
              v-bind="errorAttrs(errors, 'semester')"
            />
            <span :id="errorId('semester')" class="field-error">{{ errors.semester }}</span>
          </div>
        </fieldset>
      </FadeSlide>

      <div class="field" :class="{ 'has-error': errors.acceptDataPolicy }">
        <label class="flex cursor-pointer items-start gap-2 text-sm font-normal">
          <input
            id="acceptDataPolicy"
            v-model="form.acceptDataPolicy"
            type="checkbox"
            name="acceptDataPolicy"
            class="mt-0.5"
            v-bind="errorAttrs(errors, 'acceptDataPolicy')"
          />
          <span>{{ t("register.acceptDataPolicyLabel") }}</span>
        </label>
        <span :id="errorId('acceptDataPolicy')" class="field-error">{{ errors.acceptDataPolicy }}</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        <Spinner v-if="submitting" />
        {{ submitting ? t("register.submitting") : t("register.submit") }}
      </button>
    </form>

    <template #footer
      ><RouterLink to="/">{{ t("common.backToHome") }}</RouterLink></template
    >
  </AuthLayout>
</template>
