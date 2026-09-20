<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import { extractErrorMessage } from "../../lib/errors";
import { useAuthStore } from "../../stores/auth";
import {
  ALL_ROLES,
  listUsers,
  updateUserRole,
  updateUserStatus,
  type AdminUser,
  type AnyRole,
} from "../../services/adminUsers";

const auth = useAuthStore();
const { t } = useI18n();

const users = ref<AdminUser[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const savingId = ref<string | null>(null);

onMounted(async () => {
  try {
    users.value = await listUsers();
  } catch (error) {
    loadError.value = extractErrorMessage(error, t("adminUsers.loadError"));
  } finally {
    loading.value = false;
  }
});

/** Changes a user's role from the row's selector. */
async function onRoleChange(user: AdminUser, role: AnyRole): Promise<void> {
  if (role === user.role) return;
  actionError.value = null;
  savingId.value = user.id;
  try {
    const updated = await updateUserRole(user.id, role);
    const index = users.value.findIndex((candidate) => candidate.id === user.id);
    if (index !== -1) users.value[index] = updated;
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("adminUsers.genericServerError"));
  } finally {
    savingId.value = null;
  }
}

/** Toggles a user's account between ACTIVE and INACTIVE. */
async function onToggleStatus(user: AdminUser): Promise<void> {
  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  if (
    !window.confirm(t("adminUsers.toggleConfirm", { name: user.name, status: t(`adminUsers.status.${nextStatus}`) }))
  ) {
    return;
  }

  actionError.value = null;
  savingId.value = user.id;
  try {
    const updated = await updateUserStatus(user.id, nextStatus);
    const index = users.value.findIndex((candidate) => candidate.id === user.id);
    if (index !== -1) users.value[index] = updated;
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("adminUsers.genericServerError"));
  } finally {
    savingId.value = null;
  }
}
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="container flex max-w-4xl flex-col gap-6 py-10 sm:py-12">
      <div>
        <h1 class="text-2xl sm:text-3xl">{{ t("adminUsers.title") }}</h1>
        <p class="mt-1 text-sm">{{ t("adminUsers.subtitle") }}</p>
      </div>

      <p v-if="loading">{{ t("adminUsers.loading") }}</p>
      <p v-else-if="loadError" role="alert" class="banner banner--error">{{ loadError }}</p>

      <section v-else class="card">
        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="actionError" role="alert" class="banner banner--error mb-4">{{ actionError }}</p>
        </Transition>

        <div class="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
          <table class="w-full min-w-2xl border-collapse">
            <thead>
              <tr>
                <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
                  {{ t("adminUsers.tableName") }}
                </th>
                <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
                  {{ t("adminUsers.tableEmail") }}
                </th>
                <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
                  {{ t("adminUsers.tableRole") }}
                </th>
                <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm">
                  {{ t("adminUsers.tableStatus") }}
                </th>
                <th class="border-b border-border-soft px-2.5 py-2 text-left text-sm"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ user.name }}</td>
                <td class="border-b border-border-soft px-2.5 py-2 text-sm">{{ user.email }}</td>
                <td class="border-b border-border-soft px-2.5 py-2 text-sm">
                  <select
                    :value="user.role"
                    :disabled="savingId === user.id || user.id === auth.user?.id"
                    @change="onRoleChange(user, ($event.target as HTMLSelectElement).value as AnyRole)"
                  >
                    <option v-for="role in ALL_ROLES" :key="role" :value="role">{{ t(`roles.${role}`) }}</option>
                  </select>
                </td>
                <td class="border-b border-border-soft px-2.5 py-2 text-sm">
                  {{ user.status === "ACTIVE" ? t("adminUsers.status.ACTIVE") : t("adminUsers.status.INACTIVE") }}
                </td>
                <td class="border-b border-border-soft px-2.5 py-2 text-sm">
                  <button
                    type="button"
                    class="btn btn-ghost"
                    :disabled="savingId === user.id || user.id === auth.user?.id"
                    @click="onToggleStatus(user)"
                  >
                    {{ user.status === "ACTIVE" ? t("adminUsers.deactivate") : t("adminUsers.activate") }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>
