import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { listAuditLogs } from "../services/auditLog.service";

/** GET /audit-logs — lists critical administrative actions (HU31/RN-11). */
export const list = asyncHandler(async (_req, res) => {
  const logs = await listAuditLogs(prisma);
  res.status(200).json(logs);
});
