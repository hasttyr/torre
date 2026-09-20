import { api } from "./api";

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

/** Lists every recorded audit log entry (HU31/RN-11), most recent first. */
export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  const { data } = await api.get<AuditLogEntry[]>("/audit-logs");
  return data;
}
