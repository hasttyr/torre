<script setup lang="ts">
import { useQuery, useQueryCache } from "@pinia/colada";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import DataTable from "../../components/ui/DataTable.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import { replaceUser, usersQuery } from "../../queries/admin";
import { useQueryStatus } from "../../queries/status";
import { ALL_ROLES, updateUserRole, updateUserStatus, type AdminUser, type AnyRole } from "../../services/adminUsers";
import { useAuthStore } from "../../stores/auth";
import FadeSlide from "../../components/ui/FadeSlide.vue";
import FormBanner from "../../components/ui/FormBanner.vue";
import { dataTableColumns } from "../../components/ui/dataTableFeatures";

const auth = useAuthStore();
const confirm = useConfirm();
const { t } = useI18n();

const cache = useQueryCache();
const usersEntry = useQuery(usersQuery);
const users = computed(() => usersEntry.data.value ?? []);
const { loading, loadError, retry } = useQueryStatus(usersEntry, "adminUsers.loadError");
const actionError = ref<string | null>(null);
const savingId = ref<string | null>(null);

/** Whether the given row's controls should be disabled (in-flight save, or the admin's own row). */
function isRowLocked(user: AdminUser): boolean {
  return savingId.value === user.id || user.id === auth.user?.id;
}

/** Changes a user's role from the row's selector, after confirmation. */
async function onRoleChange(user: AdminUser, select: HTMLSelectElement): Promise<void> {
  const role = select.value as AnyRole;
  if (role === user.role) return;
  const confirmed = await confirm({
    title: t("adminUsers.changeRole"),
    message: t("adminUsers.changeRoleConfirm", {
      name: user.name,
      from: t(`roles.${user.role}`),
      to: t(`roles.${role}`),
    }),
    confirmLabel: t("adminUsers.changeRole"),
  });
  if (!confirmed) {
    // The row's data never changed, so Vue has no re-render to undo the
    // user's pick: put the <select> back by hand.
    select.value = user.role;
    return;
  }

  actionError.value = null;
  savingId.value = user.id;
  try {
    const updated = await updateUserRole(user.id, role);
    replaceUser(cache, updated);
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("common.genericServerError"));
  } finally {
    savingId.value = null;
  }
}

/** Toggles a user's account between ACTIVE and INACTIVE. */
async function onToggleStatus(user: AdminUser): Promise<void> {
  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const confirmed = await confirm({
    title: nextStatus === "INACTIVE" ? t("adminUsers.deactivate") : t("adminUsers.activate"),
    message: t("adminUsers.toggleConfirm", { name: user.name, status: t(`adminUsers.status.${nextStatus}`) }),
    confirmLabel: nextStatus === "INACTIVE" ? t("adminUsers.deactivate") : t("adminUsers.activate"),
    danger: nextStatus === "INACTIVE",
  });
  if (!confirmed) {
    return;
  }

  actionError.value = null;
  savingId.value = user.id;
  try {
    const updated = await updateUserStatus(user.id, nextStatus);
    replaceUser(cache, updated);
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("common.genericServerError"));
  } finally {
    savingId.value = null;
  }
}

const columnHelper = dataTableColumns<AdminUser>();

const columns = [
  columnHelper.accessor("name", { header: () => t("adminUsers.tableName") }),
  columnHelper.accessor("email", { header: () => t("adminUsers.tableEmail") }),
  // Rendered by the template (#cell-role): a select to change it.
  columnHelper.accessor("role", { header: () => t("adminUsers.tableRole"), enableSorting: false }),
  columnHelper.accessor("status", {
    header: () => t("adminUsers.tableStatus"),
    cell: ({ getValue }) => t(`adminUsers.status.${getValue()}`),
  }),
  // Rendered by the template (#cell-actions).
  columnHelper.display({ id: "actions", header: "", enableSorting: false }),
];
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
      <LoadError v-else-if="loadError" :message="loadError" :retry="retry" />

      <section v-else class="card">
        <FadeSlide>
          <FormBanner v-if="actionError" kind="error" class="mb-4">{{ actionError }}</FormBanner>
        </FadeSlide>

        <DataTable
          :columns="columns"
          :data="users"
          :search-placeholder="t('adminUsers.searchPlaceholder')"
          :empty-message="t('adminUsers.empty')"
          sync-url
        >
          <template #cell-role="{ row }">
            <select
              class="select-compact"
              :aria-label="t('adminUsers.roleOf', { name: row.name })"
              :value="row.role"
              :disabled="isRowLocked(row)"
              @change="onRoleChange(row, $event.target as HTMLSelectElement)"
            >
              <option v-for="role in ALL_ROLES" :key="role" :value="role">{{ t(`roles.${role}`) }}</option>
            </select>
          </template>
          <template #cell-actions="{ row }">
            <button type="button" class="btn btn-ghost" :disabled="isRowLocked(row)" @click="onToggleStatus(row)">
              {{ row.status === "ACTIVE" ? t("adminUsers.deactivate") : t("adminUsers.activate") }}
            </button>
          </template>
        </DataTable>
      </section>
    </main>
  </div>
</template>
