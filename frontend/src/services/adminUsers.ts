import { api } from "./api";
import type { RegisteredUser } from "./auth";

// Every role in the system catalog (RF03): unlike SELF_ASSIGNABLE_ROLES in
// auth.ts, an administrator assigning a role from here already went through
// requireRole("ADMINISTRATOR") on the backend, so ADMINISTRATOR itself is a
// valid target.
export const ALL_ROLES = ["PLAYER", "COACH", "ARBITER", "ORGANIZER", "ADMINISTRATOR"] as const;
export type AnyRole = (typeof ALL_ROLES)[number];

export type AdminUser = RegisteredUser;

/** Lists every user in the system (admin-only). */
export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<AdminUser[]>("/users");
  return data;
}

/** Changes a user's role (admin-only, HU03). */
export async function updateUserRole(id: string, role: AnyRole): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${id}/role`, { role });
  return data;
}

/** Activates or deactivates a user account (admin-only). */
export async function updateUserStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/users/${id}/status`, { status });
  return data;
}
