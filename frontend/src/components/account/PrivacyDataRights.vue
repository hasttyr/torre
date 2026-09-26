<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { useConfirm } from "../../lib/confirm";
import { saveFile } from "../../lib/download";
import { extractErrorMessage } from "../../lib/errors";
import { requestDataAccess, requestDataSuppression } from "../../services/dataRights";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const confirm = useConfirm();
const { t } = useI18n();

// HU22/Ley 1581 de 2012: derechos ARCO. "Rectificar" ya tiene su propio
// flujo (la sección "Editar perfil" de arriba, HU20); acá van los dos
// derechos que no tienen otra UI: acceso y supresión.

const downloading = ref(false);
const downloadError = ref<string | null>(null);

/** Downloads the titular's own data as a JSON file (HU22, derecho de acceso). */
async function onDownloadData(): Promise<void> {
  downloadError.value = null;
  downloading.value = true;
  try {
    const result = await requestDataAccess();
    const blob = new Blob([JSON.stringify(result.user, null, 2)], { type: "application/json" });
    saveFile(blob, "mis-datos-torre.json");
  } catch (error) {
    downloadError.value = extractErrorMessage(error, t("account.privacyGenericError"));
  } finally {
    downloading.value = false;
  }
}

const deleting = ref(false);
const deleteError = ref<string | null>(null);
const deleteMessage = ref<string | null>(null);

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
    setTimeout(async () => {
      await auth.logout();
      router.push("/");
    }, 2500);
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
          date: auth.user.dataConsent.date ? new Date(auth.user.dataConsent.date).toLocaleDateString() : "—",
          version: auth.user.dataConsent.version ?? "—",
        })
      }}
    </p>

    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 -translate-y-1.5"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0 -translate-y-1.5"
    >
      <p v-if="deleteMessage" class="banner banner--success mb-4">{{ deleteMessage }}</p>
    </Transition>
    <Transition
      enter-active-class="transition duration-180 ease-out"
      enter-from-class="opacity-0 -translate-y-1.5"
      leave-active-class="transition duration-180 ease-in"
      leave-to-class="opacity-0 -translate-y-1.5"
    >
      <p v-if="downloadError || deleteError" role="alert" class="banner banner--error mb-4">
        {{ downloadError ?? deleteError }}
      </p>
    </Transition>

    <div class="flex flex-wrap gap-3">
      <button type="button" class="btn btn-ghost" :disabled="downloading" @click="onDownloadData">
        {{ downloading ? t("account.privacyDownloading") : t("account.privacyDownloadButton") }}
      </button>
      <button
        type="button"
        class="btn border-red-500/50 text-red-500 hover:bg-red-500/10"
        :disabled="deleting || Boolean(deleteMessage)"
        @click="onDeleteData"
      >
        {{ deleting ? t("account.privacyDeleting") : t("account.privacyDeleteButton") }}
      </button>
    </div>
  </section>
</template>
