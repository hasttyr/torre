import type { Prisma, PrismaClient } from "../generated/prisma/client";

import type { AuditLogQuery } from "../validators/auditLogs.schemas";
import { AUDIT_ACTIONS, type AuditAction } from "../contracts/catalogs";
import type { AuditLogDto, AuditLogPage } from "../contracts/responses";

// The closed catalog of critical actions (RN-11) is part of the API contract:
// a mistyped code doesn't compile, instead of logging an action nobody reads.
export { AUDIT_ACTIONS, type AuditAction };

// People are referenced in an entry's detail by id, never by name, and
// named when the log is read: once someone's data is suppressed (HU22), the
// entries that mention them read "Usuario eliminado" with no rewrite.
const MENTION = /\{\{user:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}\}/g;

/** How an entry's detail refers to a person (a user id): see {@link listAuditLogs}. */
export function mention(userId: string): string {
  return `{{user:${userId}}}`;
}

/** Replaces every {@link mention} in the details with the person's current name. */
async function nameMentions(prisma: PrismaClient, details: (string | null)[]): Promise<(string | null)[]> {
  const ids = new Set(details.flatMap((detail) => [...(detail ?? "").matchAll(MENTION)].map((match) => match[1]!)));
  if (ids.size === 0) return details;
  const users = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
  const names = new Map(users.map((user) => [user.id, user.name]));
  return details.map((detail) => detail?.replace(MENTION, (_, id: string) => names.get(id) ?? "—") ?? null);
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
  action: AuditAction,
  detail?: string,
): Promise<{ id: string }> {
  return prisma.auditLog.create({ data: { userId, action, detail }, select: { id: true } });
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
  const details = await nameMentions(
    prisma,
    page.map((log) => log.detail),
  );
  return {
    entries: page.map((log, index) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user.name,
      action: log.action,
      detail: details[index] ?? null,
      createdAt: log.createdAt,
    })),
    nextCursor: logs.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}

export type { AuditLogDto, AuditLogPage };
