import type { Prisma, PrismaClient } from "@prisma/client";

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
 * Call it with the same transaction client as the action it records, so
 * both commit or neither does: a critical action whose audit trail can't be
 * written must fail, not silently succeed unaudited.
 */
export function recordAuditLog(
  prisma: Prisma.TransactionClient,
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
