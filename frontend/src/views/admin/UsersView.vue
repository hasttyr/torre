<script setup lang="ts">
import { createColumnHelper } from "@tanstack/vue-table";
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import AppHeader from "../../components/layout/AppHeader.vue";
import DataTable from "../../components/ui/DataTable.vue";
import LoadError from "../../components/ui/LoadError.vue";
import { useConfirm } from "../../lib/confirm";
import { extractErrorMessage } from "../../lib/errors";
import {
  ALL_ROLES,
  listUsers,
  updateUserRole,
  updateUserStatus,
  type AdminUser,
  type AnyRole,
} from "../../services/adminUsers";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const confirm = useConfirm();
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
    const index = users.value.findIndex((candidate) => candidate.id === user.id);
    if (index !== -1) users.value[index] = updated;
  } catch (error) {
    actionError.value = extractErrorMessage(error, t("adminUsers.genericServerError"));
  } finally {
    savingId.value = null;
  }
}

const columnHelper = createColumnHelper<AdminUser>();

const columns = [
  columnHelper.accessor("name", { header: () => t("adminUsers.tableName") }),
  columnHelper.accessor("email", { header: () => t("adminUsers.tableEmail") }),
  columnHelper.accessor("role", {
    header: () => t("adminUsers.tableRole"),
    enableSorting: false,
    cell: ({ row }) =>
      h(
        "select",
        {
          class: "select-compact",
          "aria-label": t("adminUsers.roleOf", { name: row.original.name }),
          value: row.original.role,
          disabled: isRowLocked(row.original),
          onChange: (event: Event) => onRoleChange(row.original, event.target as HTMLSelectElement),
        },
        ALL_ROLES.map((role) => h("option", { value: role }, t(`roles.${role}`))),
      ),
  }),
  columnHelper.accessor("status", {
    header: () => t("adminUsers.tableStatus"),
    cell: ({ getValue }) => t(`adminUsers.status.${getValue()}`),
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) =>
      h(
        "button",
        {
          type: "button",
          class: "btn btn-ghost",
          disabled: isRowLocked(row.original),
          onClick: () => onToggleStatus(row.original),
        },
        row.original.status === "ACTIVE" ? t("adminUsers.deactivate") : t("adminUsers.activate"),
      ),
  }),
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
      <LoadError v-else-if="loadError" :message="loadError" />

      <section v-else class="card">
        <Transition
          enter-active-class="transition duration-180 ease-out"
          enter-from-class="opacity-0 -translate-y-1.5"
          leave-active-class="transition duration-180 ease-in"
          leave-to-class="opacity-0 -translate-y-1.5"
        >
          <p v-if="actionError" role="alert" class="banner banner--error mb-4">{{ actionError }}</p>
        </Transition>

        <DataTable
          :columns="columns"
          :data="users"
          :search-placeholder="t('adminUsers.searchPlaceholder')"
          :empty-message="t('adminUsers.empty')"
          sync-url
        />
      </section>
    </main>
  </div>
</template>
