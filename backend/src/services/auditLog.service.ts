import type { PrismaClient } from "@prisma/client";

export interface AuditLogDto {
  id: string;
  userId: string;
  userName: string;
  action: string;
  detail: string | null;
  createdAt: Date;
}

/**
 * Records a critical administrative action (RN-11): role change, result
 * correction, manual pairing adjustment, player withdrawal.
 *
 * @remarks
 * Deliberately fire-and-forget from the caller's perspective (awaited, but
 * never wrapped in a try/catch that would swallow the original action if
 * logging fails) — a critical action whose audit trail can't be written
 * should fail loudly, not silently succeed unaudited.
 */
export function recordAuditLog(
  prisma: PrismaClient,
  userId: string,
  action: string,
  detail?: string,
): Promise<{ id: string }> {
  return prisma.auditLog.create({ data: { userId, action, detail }, select: { id: true } });
}

/** Lists every recorded audit log entry, most recent first. */
export async function listAuditLogs(prisma: PrismaClient): Promise<AuditLogDto[]> {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    userId: log.userId,
    userName: log.user.name,
    action: log.action,
    detail: log.detail,
    createdAt: log.createdAt,
  }));
}
