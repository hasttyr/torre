<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useConfirm } from "../../lib/confirm";
import { saveFile } from "../../lib/download";
import { extractErrorMessage } from "../../lib/errors";
import { formatLocalDate } from "../../lib/format";
import { signOut } from "../../lib/signOut";
import { requestDataAccess, requestDataSuppression } from "../../services/dataRights";
import { useAuthStore } from "../../stores/auth";
import { useLocaleStore } from "../../stores/locale";
import FadeSlide from "../ui/FadeSlide.vue";
import FormBanner from "../ui/FormBanner.vue";

const auth = useAuthStore();
const locale = useLocaleStore();
const confirm = useConfirm();
const { t } = useI18n();

// HU22/Ley 1581 de 2012: derechos ARCO. "Rectificar" ya tiene su propio
// flujo (la sección "Editar perfil" de arriba, HU20); acá van los dos
// derechos que no tienen otra UI: acceso y supresión.

const downloading = ref(false);
const downloadError = ref<string | null>(null);

/** Downloads everything held about the titular as a JSON file (HU22, derecho de acceso). */
async function onDownloadData(): Promise<void> {
  downloadError.value = null;
  downloading.value = true;
  try {
    const result = await requestDataAccess();
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    saveFile(blob, t("account.privacyDownloadFilename"));
  } catch (error) {
    downloadError.value = extractErrorMessage(error, t("account.privacyGenericError"));
  } finally {
    downloading.value = false;
  }
}

const deleting = ref(false);
const deleteError = ref<string | null>(null);
const deleteMessage = ref<string | null>(null);

// How long the suppression notice stays up before the session ends.
const NOTICE_MS = 2500;
let pendingSignOut: ReturnType<typeof setTimeout> | undefined;

// The account is gone either way: if the user leaves before the notice times
// out, the session ends right then, not later from whatever page they're on.
onBeforeUnmount(() => {
  if (pendingSignOut === undefined) return;
  clearTimeout(pendingSignOut);
  void signOut();
});

/**
 * Requests suppression of the titular's own data (HU22).
 *
 * @remarks
 * The account is deactivated either way (blocked or fully anonymized), so
 * the session is closed right after the confirmation is shown.
 */
async function onDeleteData(): Promise<void> {
  const confirmed = await confirm({
    title: t("account.privacyDeleteButton"),
    message: t("account.privacyDeleteConfirm"),
    confirmLabel: t("account.privacyDeleteButton"),
    danger: true,
  });
  if (!confirmed) {
    return;
  }

  deleteError.value = null;
  deleting.value = true;
  try {
    const result = await requestDataSuppression();
    deleteMessage.value = result.message;
    pendingSignOut = setTimeout(() => {
      pendingSignOut = undefined;
      void signOut();
    }, NOTICE_MS);
  } catch (error) {
    deleteError.value = extractErrorMessage(error, t("account.privacyGenericError"));
    deleting.value = false;
  }
}
</script>

<template>
  <section class="card mt-6">
    <h2 class="mb-1 text-lg">{{ t("account.privacyTitle") }}</h2>
    <p class="mb-4 text-sm">{{ t("account.privacySubtitle") }}</p>

    <p v-if="auth.user?.dataConsent?.accepted" class="mb-4 text-sm text-text-muted">
      {{
        t("account.privacyConsentInfo", {
          date: auth.user.dataConsent.date ? formatLocalDate(auth.user.dataConsent.date, locale.locale) : "—",
          version: auth.user.dataConsent.version ?? "—",
        })
      }}
    </p>

    <FadeSlide>
      <FormBanner v-if="deleteMessage" kind="success" class="mb-4">{{ deleteMessage }}</FormBanner>
    </FadeSlide>
    <FadeSlide>
      <FormBanner v-if="downloadError || deleteError" kind="error" class="mb-4">{{
        downloadError ?? deleteError
      }}</FormBanner>
    </FadeSlide>

    <div class="flex flex-wrap gap-3">
      <button type="button" class="btn btn-ghost" :disabled="downloading" @click="onDownloadData">
        {{ downloading ? t("account.privacyDownloading") : t("account.privacyDownloadButton") }}
      </button>
      <button
        type="button"
        class="btn border-error/50 text-error hover:bg-error/10"
        :disabled="deleting || Boolean(deleteMessage)"
        @click="onDeleteData"
      >
        {{ deleting ? t("account.privacyDeleting") : t("account.privacyDeleteButton") }}
      </button>
    </div>
  </section>
</template>
