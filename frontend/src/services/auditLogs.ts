import type { AuditLogDto, AuditLogPage as AuditLogPageDto } from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api } from "./api";

export type AuditLogEntry = Serialized<AuditLogDto>;
export type AuditLogPage = Serialized<AuditLogPageDto>;

/**
 * One page of the audit log (HU31/RN-11), most recent first.
 *
 * @param cursor - The previous page's `nextCursor`; omit it for the newest page.
 */
export async function listAuditLogs(cursor?: string): Promise<AuditLogPage> {
  const { data } = await api.get<AuditLogPage>("/audit-logs", { params: cursor ? { cursor } : {} });
  return data;
}
