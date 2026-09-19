<script setup lang="ts">
import axios from "axios";
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

import AuthLayout from "../components/AuthLayout.vue";
import { registerUser, SELF_ASSIGNABLE_ROLES, type RegisterPayload, type SelfAssignableRole } from "../services/auth";

const { t } = useI18n();

const ROLE_GLYPHS: Record<SelfAssignableRole, string> = {
  JUGADOR: "♙",
  ENTRENADOR: "♗",
  ARBITRO: "♘",
  ORGANIZADOR: "♕",
};

const form = reactive({
  name: "",
  email: "",
  password: "",
  role: "JUGADOR" as SelfAssignableRole,
  universityCode: "",
  program: "",
  semester: "",
});

const isPlayer = computed(() => form.role === "JUGADOR");

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
const successMessage = ref<string | null>(null);
const serverError = ref<string | null>(null);

/**
 * Validates the registration form, mirroring
 * backend/src/validators/auth.schemas.ts.
 *
 * @remarks This is UX validation (immediate feedback); the validation that
 * ultimately decides is always the backend's.
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

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

  return Object.keys(errors).length === 0;
}

/** Builds the registration API payload from the form, shaped by the chosen role. */
function buildPayload(): RegisterPayload {
  const base = {
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
  };

  if (form.role === "JUGADOR") {
    return {
      ...base,
      role: "JUGADOR",
      universityCode: form.universityCode.trim(),
      program: form.program.trim(),
      semester: Number(form.semester),
    };
  }

  return { ...base, role: form.role };
}

/** Clears the registration form back to its initial empty state. */
function resetForm(): void {
  form.name = "";
  form.email = "";
  form.password = "";
  form.universityCode = "";
  form.program = "";
  form.semester = "";
}

/** Validates and submits the registration form to the backend. */
async function onSubmit(): Promise<void> {
  successMessage.value = null;
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    const user = await registerUser(buildPayload());
    successMessage.value = t("register.successMessage", { email: user.email });
    resetForm();
  } catch (error) {
    if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
      serverError.value = error.response.data.error;
    } else {
      serverError.value = t("auth.serverError");
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('register.title')" :subtitle="t('register.subtitle')">
    <template #banners>
      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <output v-if="successMessage" class="banner banner--success">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" class="mt-0.5 shrink-0">
            <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" />
            <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ successMessage }}</span>
        </output>
      </Transition>

      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <p v-if="serverError" role="alert" class="banner banner--error">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true" class="mt-0.5 shrink-0">
            <path d="M10 2 1 17h18L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
            <path d="M10 8v3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
            <circle cx="10" cy="14" r="0.9" fill="currentColor" />
          </svg>
          <span>{{ serverError }}</span>
        </p>
      </Transition>
    </template>

    <form novalidate @submit.prevent="onSubmit">
      <div class="field">
        <span class="field-label">{{ t("register.roleLabel") }}</span>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" :aria-label="t('register.roleLabel')">
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
        <input id="name" v-model="form.name" type="text" autocomplete="name" :placeholder="t('register.namePlaceholder')" />
        <span class="field-error">{{ errors.name }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">{{ t("auth.email") }}</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" :placeholder="t('register.emailPlaceholder')" />
        <span class="field-error">{{ errors.email }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.password }">
        <label for="password">{{ t("auth.password") }}</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          :placeholder="t('register.passwordPlaceholder')"
        />
        <span class="field-error">{{ errors.password }}</span>
      </div>

      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <fieldset v-if="isPlayer" class="m-0 flex flex-col gap-4 rounded-xl border border-dashed border-border p-4 pt-4">
          <legend class="px-1.5 text-[0.8rem] font-semibold text-text-muted">{{ t("register.playerDataLegend") }}</legend>

          <div class="field" :class="{ 'has-error': errors.universityCode }">
            <label for="universityCode">{{ t("register.universityCodeLabel") }}</label>
            <input id="universityCode" v-model="form.universityCode" type="text" :placeholder="t('register.universityCodePlaceholder')" />
            <span class="field-error">{{ errors.universityCode }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.program }">
            <label for="program">{{ t("register.programLabel") }}</label>
            <input id="program" v-model="form.program" type="text" :placeholder="t('register.programPlaceholder')" />
            <span class="field-error">{{ errors.program }}</span>
          </div>

          <div class="field" :class="{ 'has-error': errors.semester }">
            <label for="semester">{{ t("register.semesterLabel") }}</label>
            <input id="semester" v-model="form.semester" type="number" min="1" :placeholder="t('register.semesterPlaceholder')" />
            <span class="field-error">{{ errors.semester }}</span>
          </div>
        </fieldset>
      </Transition>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        <svg v-if="submitting" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        {{ submitting ? t("register.submitting") : t("register.submit") }}
      </button>
    </form>

    <template #footer><RouterLink to="/">{{ t("common.backToHome") }}</RouterLink></template>
  </AuthLayout>
</template>
