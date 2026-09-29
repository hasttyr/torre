<script setup lang="ts">
import { computed, onMounted, reactive, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import AuthLayout from "../../components/layout/AuthLayout.vue";
import { extractErrorMessage } from "../../lib/errors";
import { errorAttrs, errorId, focusFirstInvalid, resetErrors } from "../../lib/formErrors";
import { whenIdle } from "../../lib/idle";
import { prefetchRoute } from "../../lib/prefetchRoute";
import { HOME_PATH } from "../../lib/roleHome";
import { useAuthStore } from "../../stores/auth";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";
import Spinner from "../../components/ui/Spinner.vue";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const { t } = useI18n();

// While the user types, fetch the dashboard's code (and the HTTP client it
// pulls in) so it opens as soon as the login succeeds.
onMounted(() => whenIdle(() => prefetchRoute(router, HOME_PATH)));

const form = reactive({ email: "", password: "" });
const errors = reactive<Record<string, string>>({});
const formEl = useTemplateRef<HTMLFormElement>("formEl");
const submitting = ref(false);
const serverError = ref<string | null>(null);
// Set by lib/sessionExpiry.ts when the server rejected the previous session.
const sessionExpired = computed(() => route.query.expired === "1");
// Set by the registration page when the account was created but its automatic sign-in failed.
const justRegistered = computed(() => route.query.registered === "1");

/**
 * Validates the login form.
 *
 * @returns `true` if the form has no validation errors.
 */
function validate(): boolean {
  resetErrors(errors);

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
    await focusFirstInvalid(formEl.value);
    return;
  }

  submitting.value = true;
  try {
    await auth.login(form.email.trim(), form.password);
    const redirect = route.query.redirect;
    // Only honor an internal, single-slash path: the redirect query comes
    // from the router guard, but it's still user-controlled input via the
    // URL bar, and "//evil.com" is browser-parsed as an external URL.
    const isSafeInternalPath = typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//");
    router.push(isSafeInternalPath ? redirect : HOME_PATH);
  } catch (error) {
    serverError.value = extractErrorMessage(error, t("common.genericServerError"));
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
      <p v-if="sessionExpired && !serverError" role="status" class="banner border-border bg-surface-2 text-text-muted">
        {{ t("login.sessionExpired") }}
      </p>
      <FormBanner v-if="justRegistered && !serverError" kind="success">{{ t("login.registered") }}</FormBanner>
      <FadeSlide>
        <FormBanner v-if="serverError" kind="error">{{ serverError }}</FormBanner>
      </FadeSlide>
    </template>

    <form ref="formEl" novalidate @submit.prevent="onSubmit">
      <div class="field" :class="{ 'has-error': errors.email }">
        <label for="email">{{ t("auth.email") }}</label>
        <input
          id="email"
          v-model="form.email"
          type="email"
          name="email"
          autocomplete="email"
          spellcheck="false"
          :placeholder="t('login.emailPlaceholder')"
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
          autocomplete="current-password"
          :placeholder="t('login.passwordPlaceholder')"
          v-bind="errorAttrs(errors, 'password')"
        />
        <span :id="errorId('password')" class="field-error">{{ errors.password }}</span>
      </div>

      <RouterLink to="/olvide-password" class="-mt-2 self-end text-sm text-text-muted hover:text-accent">
        {{ t("login.forgotPassword") }}
      </RouterLink>

      <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">
        <Spinner v-if="submitting" />
        {{ submitting ? t("login.submitting") : t("login.submit") }}
      </button>
    </form>

    <template #footer>
      {{ t("login.noAccount") }} <RouterLink to="/registro">{{ t("login.createOne") }}</RouterLink>
    </template>
  </AuthLayout>
</template>
