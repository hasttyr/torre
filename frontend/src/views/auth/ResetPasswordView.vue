<script setup lang="ts">
import { reactive, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import AuthLayout from "../../components/layout/AuthLayout.vue";
import { extractErrorMessage } from "../../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid, resetErrors } from "../../lib/formErrors";
import { confirmPasswordReset } from "../../services/auth";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";

const route = useRoute();
const { t } = useI18n();

// The reset link (HU19) carries the one-time token as a query param. It's
// kept in memory only: replacing the URL takes it out of the address bar and
// the browser history (synced ones included), where anyone using this
// computer later could find a still-valid link. A reload then asks for a new
// link, as for any missing token.
const token = typeof route.query.token === "string" ? route.query.token : "";
if (token) void useRouter().replace({ query: {} });

const form = reactive({ newPassword: "", confirmPassword: "" });
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const submitted = ref(false);
const serverError = ref<string | null>(null);
const formEl = useTemplateRef<HTMLFormElement>("formEl");

/** Validates the reset-password form. */
function validate(): boolean {
  resetErrors(errors);

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
    await focusFirstInvalid(formEl.value);
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
      <FadeSlide>
        <FormBanner v-if="serverError" kind="error">{{ serverError }}</FormBanner>
      </FadeSlide>
    </template>

    <FormBanner v-if="!token" kind="error">{{ t("resetPassword.missingTokenError") }}</FormBanner>

    <FormBanner v-else-if="submitted" kind="success">{{ t("resetPassword.successMessage") }}</FormBanner>

    <form v-else ref="formEl" novalidate @submit.prevent="onSubmit">
      <div class="field" :class="{ 'has-error': errors.newPassword }">
        <label for="newPassword">{{ t("resetPassword.newPasswordLabel") }}</label>
        <input
          id="newPassword"
          v-model="form.newPassword"
          type="password"
          name="newPassword"
          autocomplete="new-password"
          :placeholder="t('register.passwordPlaceholder')"
          v-bind="errorAttrs(errors, 'newPassword')"
        />
        <span :id="errorId('newPassword')" class="field-error">{{ errors.newPassword }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.confirmPassword }">
        <label for="confirmPassword">{{ t("resetPassword.confirmPasswordLabel") }}</label>
        <input
          id="confirmPassword"
          v-model="form.confirmPassword"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
          v-bind="errorAttrs(errors, 'confirmPassword')"
        />
        <span :id="errorId('confirmPassword')" class="field-error">{{ errors.confirmPassword }}</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        {{ submitting ? t("resetPassword.submitting") : t("resetPassword.submit") }}
      </button>
    </form>

    <!-- A link that's missing its token, expired or already used can't be
         fixed here: the way forward is a new one. -->
    <p v-if="!token || serverError" class="mt-4 text-sm">
      <RouterLink to="/olvide-password" class="font-semibold text-accent">
        {{ t("resetPassword.requestNewLink") }}
      </RouterLink>
    </p>

    <template #footer>
      <RouterLink to="/login">{{ t("resetPassword.goToLogin") }}</RouterLink>
    </template>
  </AuthLayout>
</template>
