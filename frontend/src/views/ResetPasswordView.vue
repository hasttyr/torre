<script setup lang="ts">
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";

import AuthLayout from "../components/AuthLayout.vue";
import { extractErrorMessage } from "../lib/errors";
import { confirmPasswordReset } from "../services/auth";

const route = useRoute();
const { t } = useI18n();

// The reset link (HU19) carries the one-time token as a query param.
const token = typeof route.query.token === "string" ? route.query.token : "";

const form = reactive({ newPassword: "", confirmPassword: "" });
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const submitted = ref(false);
const serverError = ref<string | null>(null);

/** Validates the reset-password form. */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (form.newPassword.length < 8) {
    errors.newPassword = t("auth.passwordMinLength");
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = t("resetPassword.passwordMismatch");
  }

  return Object.keys(errors).length === 0;
}

/** Validates and confirms the password reset with the token from the link. */
async function onSubmit(): Promise<void> {
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    await confirmPasswordReset(token, form.newPassword);
    submitted.value = true;
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("resetPassword.invalidTokenError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('resetPassword.title')" :subtitle="t('resetPassword.subtitle')">
    <template #banners>
      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <p v-if="serverError" role="alert" class="banner banner--error">{{ serverError }}</p>
      </Transition>
    </template>

    <p v-if="!token" role="alert" class="banner banner--error">{{ t("resetPassword.missingTokenError") }}</p>

    <p v-else-if="submitted" class="banner banner--success">{{ t("resetPassword.successMessage") }}</p>

    <form v-else novalidate @submit.prevent="onSubmit">
      <div class="field" :class="{ 'has-error': errors.newPassword }">
        <label for="newPassword">{{ t("resetPassword.newPasswordLabel") }}</label>
        <input
          id="newPassword"
          v-model="form.newPassword"
          type="password"
          autocomplete="new-password"
          :placeholder="t('register.passwordPlaceholder')"
        />
        <span class="field-error">{{ errors.newPassword }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.confirmPassword }">
        <label for="confirmPassword">{{ t("resetPassword.confirmPasswordLabel") }}</label>
        <input id="confirmPassword" v-model="form.confirmPassword" type="password" autocomplete="new-password" />
        <span class="field-error">{{ errors.confirmPassword }}</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        {{ submitting ? t("resetPassword.submitting") : t("resetPassword.submit") }}
      </button>
    </form>

    <template #footer>
      <RouterLink to="/login">{{ t("resetPassword.goToLogin") }}</RouterLink>
    </template>
  </AuthLayout>
</template>
