import { api } from "./api";

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  // Pass it back for the next (older) page; null on the last one.
  nextCursor: string | null;
}

/**
 * One page of the audit log (HU31/RN-11), most recent first.
 *
 * @param cursor - The previous page's `nextCursor`; omit it for the newest page.
 */
export async function listAuditLogs(cursor?: string): Promise<AuditLogPage> {
  const { data } = await api.get<AuditLogPage>("/audit-logs", { params: cursor ? { cursor } : {} });
  return data;
}
