<script setup lang="ts">
import { reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import AuthLayout from "../components/AuthLayout.vue";
import { extractErrorMessage } from "../lib/errors";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

const form = reactive({ email: "", password: "" });
const errors = reactive<Record<string, string>>({});
const submitting = ref(false);
const serverError = ref<string | null>(null);

/**
 * Validates the login form.
 *
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  for (const key of Object.keys(errors)) {
    delete errors[key];
  }

  if (!form.email.trim()) {
    errors.email = t("auth.emailRequired");
  }
  if (!form.password) {
    errors.password = t("auth.passwordRequired");
  }

  return Object.keys(errors).length === 0;
}

/** Validates and submits the login form. */
async function onSubmit(): Promise<void> {
  serverError.value = null;

  if (!validate()) {
    return;
  }

  submitting.value = true;
  try {
    await auth.login(form.email.trim(), form.password);
    router.push("/cuenta");
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("auth.serverError"));
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout
    :title="t('login.title')"
    :subtitle="t('login.subtitle')"
    :quote="t('login.quote')"
    :quote-author="t('login.quoteAuthor')"
  >
    <template #banners>
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
      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">{{ t("auth.email") }}</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          :placeholder="t('login.emailPlaceholder')"
        />
        <span class="field-error">{{ errors.email }}</span>
      </div>

      <div class="field" :class="{ 'has-error': errors.password }">
        <label for="password">{{ t("auth.password") }}</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          :placeholder="t('login.passwordPlaceholder')"
        />
        <span class="field-error">{{ errors.password }}</span>
      </div>

      <RouterLink to="/olvide-password" class="-mt-2 self-end text-sm text-text-muted hover:text-accent">
        {{ t("login.forgotPassword") }}
      </RouterLink>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        <svg
          v-if="submitting"
          class="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        {{ submitting ? t("login.submitting") : t("login.submit") }}
      </button>
    </form>

    <template #footer>
      {{ t("login.noAccount") }} <RouterLink to="/registro">{{ t("login.createOne") }}</RouterLink>
    </template>
  </AuthLayout>
</template>
