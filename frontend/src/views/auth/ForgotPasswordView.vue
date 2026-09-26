<script setup lang="ts">
import { reactive, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

import AuthLayout from "../../components/layout/AuthLayout.vue";
import { extractErrorMessage } from "../../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid } from "../../lib/formErrors";
import { requestPasswordReset } from "../../services/auth";

const { t } = useI18n();

const email = ref("");
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref<string | null>(null);
const formEl = useTemplateRef<HTMLFormElement>("formEl");

/**
 * Requests a password-reset link for the given email (HU19).
 *
 * @remarks
 * Always ends in the same generic success state whether or not the email is
 * registered (CA HU19: doesn't reveal whether an account exists).
 */
async function onSubmit(): Promise<void> {
  errorMessage.value = null;
  // An empty email would still get the generic "check your inbox" answer.
  delete errors.email;
  if (!email.value.trim()) {
    errors.email = t("auth.emailRequired");
    await focusFirstInvalid(formEl.value);
    return;
  }

  submitting.value = true;
  try {
    await requestPasswordReset(email.value.trim());
    submitted.value = true;
  } catch (error) {
    errorMessage.value = extractErrorMessage(error, t("auth.serverError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout :title="t('forgotPassword.title')" :subtitle="t('forgotPassword.subtitle')">
    <template #banners>
      <Transition
        enter-active-class="transition duration-180 ease-out"
        enter-from-class="opacity-0 -translate-y-1.5"
        leave-active-class="transition duration-180 ease-in"
        leave-to-class="opacity-0 -translate-y-1.5"
      >
        <p v-if="errorMessage" role="alert" class="banner banner--error">{{ errorMessage }}</p>
      </Transition>
    </template>

    <p v-if="submitted" class="banner banner--success">{{ t("forgotPassword.successMessage") }}</p>

    <form v-else ref="formEl" novalidate @submit.prevent="onSubmit">
      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">{{ t("auth.email") }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          spellcheck="false"
          :placeholder="t('login.emailPlaceholder')"
          v-bind="errorAttrs(errors, 'email')"
        />
        <span :id="errorId('email')" class="field-error">{{ errors.email }}</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        {{ submitting ? t("forgotPassword.submitting") : t("forgotPassword.submit") }}
      </button>
    </form>

    <template #footer>
      <RouterLink to="/login">{{ t("forgotPassword.backToLogin") }}</RouterLink>
    </template>
  </AuthLayout>
</template>
