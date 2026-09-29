import { defineInfiniteQueryOptions, defineQueryOptions, type QueryCache } from "@pinia/colada";

import { listUsers, type AdminUser } from "../services/adminUsers";
import { listAuditLogs } from "../services/auditLogs";
import { getDashboardLayouts, type RoleLayout } from "../services/dashboard";

// What the administrator's pages read, cached with Pinia Colada.

export const usersQuery = defineQueryOptions({
  key: ["users"],
  query: () => listUsers(),
});

/** Shows an account as the server answered a change to it (role, status). */
export function replaceUser(cache: QueryCache, user: AdminUser): void {
  cache.setQueryData(usersQuery.key, (users = []) => users.map((listed) => (listed.id === user.id ? user : listed)));
}

/** Every configurable role's dashboard, and the widget catalog to compose them from. */
export const dashboardLayoutsQuery = defineQueryOptions({
  key: ["dashboard-layouts"],
  query: () => getDashboardLayouts(),
});

/** Shows a role's dashboard as the server saved it. */
export function replaceRoleLayout(cache: QueryCache, saved: RoleLayout): void {
  const data = cache.getQueryData(dashboardLayoutsQuery.key);
  if (!data) return;
  const layouts = data.layouts.map((layout) => (layout.role === saved.role ? saved : layout));
  cache.setQueryData(dashboardLayoutsQuery.key, { ...data, layouts });
}

/** The audit log (RN-11): newest page first, each older one on demand, following the server's cursor. */
export const auditLogQuery = defineInfiniteQueryOptions({
  key: ["audit-logs"],
  query: ({ pageParam }) => listAuditLogs(pageParam ?? undefined),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
