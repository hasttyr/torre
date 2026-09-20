import { Router } from "express";

import { list } from "../controllers/auditLogs.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const auditLogsRouter = Router();

// RN-11 traces critical actions across the whole system (role changes,
// player withdrawals, ...), not just one organizer's tournaments — so
// oversight is reserved to ADMINISTRATOR, same boundary as PATCH /users/:id/role.
auditLogsRouter.get("/", requireAuth, requireRole("ADMINISTRATOR"), list);
