import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listAuditLogs } from "../services/auditLog.service";
import { auditLogQuerySchema } from "../validators/auditLogs.schemas";
import { parseOrThrow } from "../validators/parse";

/** GET /audit-logs?limit=&cursor= — one page of critical administrative actions (HU31/RN-11). */
export const list = asyncHandler(async (req, res) => {
  const page = await listAuditLogs(prisma, parseOrThrow(auditLogQuerySchema, req.query));
  res.status(200).json(page);
});
