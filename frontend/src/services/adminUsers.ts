import { ROLES as ALL_ROLES, type Role as AnyRole } from "@contracts";

import { api, path } from "./api";
import type { RegisteredUser } from "./auth";

export { ALL_ROLES, type AnyRole };

export type AdminUser = RegisteredUser;

/** Lists every user in the system (admin-only). */
export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<AdminUser[]>("/users");
  return data;
}

/** Changes a user's role (admin-only, HU03). */
export async function updateUserRole(id: string, role: AnyRole): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(path`/users/${id}/role`, { role });
  return data;
}

/** Activates or deactivates a user account (admin-only). */
export async function updateUserStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(path`/users/${id}/status`, { status });
  return data;
}
