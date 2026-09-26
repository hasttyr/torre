import type { Prisma, PrismaClient } from "@prisma/client";

import type { AuditLogQuery } from "../validators/auditLogs.schemas";

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

export interface AuditLogPage {
  entries: AuditLogDto[];
  // Pass it back as `cursor` for the next (older) page; null on the last one.
  nextCursor: string | null;
}

/** One page of the audit log, most recent first. */
export async function listAuditLogs(prisma: PrismaClient, { limit, cursor }: AuditLogQuery): Promise<AuditLogPage> {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    // id breaks ties between entries recorded in the same instant, so
    // pages never skip or repeat one (see the matching index).
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // One more than the page: if it comes back, there's a next page.
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = logs.slice(0, limit);
  return {
    entries: page.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user.name,
      action: log.action,
      detail: log.detail,
      createdAt: log.createdAt,
    })),
    nextCursor: logs.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}
