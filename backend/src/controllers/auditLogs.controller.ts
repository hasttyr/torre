import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { listAuditLogs } from "../services/auditLog.service";
import { auditLogQuerySchema } from "../validators/auditLogs.schemas";
import { parseOrThrow } from "../validators/parse";

/** GET /audit-logs?limit=&cursor= — one page of critical administrative actions (HU31/RN-11). */
export async function list(req: Request, res: Response): Promise<void> {
  const page = await listAuditLogs(prisma, parseOrThrow(auditLogQuerySchema, req.query));
  res.status(200).json(page);
}
