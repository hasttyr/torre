import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import {
  getDashboard,
  getWidgetData,
  listDashboardLayouts,
  updateRoleLayout,
} from "../services/dashboard/dashboard.service";
import {
  configurableRoleSchema,
  updateLayoutSchema,
  widgetKeySchema,
  widgetQuerySchema,
} from "../validators/dashboard.schemas";
import { parseOrThrow } from "../validators/parse";

/** GET /dashboard — the current user's widgets and the players they can inspect. */
export async function getMine(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getDashboard(prisma, req.user!));
}

/** GET /dashboard/widgets/:key?playerId= — one widget's data, if the user's role has it. */
export async function getWidget(req: Request, res: Response): Promise<void> {
  const key = parseOrThrow(widgetKeySchema, req.params.key);
  const { playerId } = parseOrThrow(widgetQuerySchema, req.query);
  res.status(200).json(await getWidgetData(prisma, req.user!, key, playerId));
}

/** GET /dashboard/layouts — the widget catalog and every role's layout (admin-only). */
export async function listLayouts(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await listDashboardLayouts(prisma));
}

/** PUT /dashboard/layouts/:role — replaces a role's widgets and their order (admin-only). */
export async function updateLayout(req: Request, res: Response): Promise<void> {
  const role = parseOrThrow(configurableRoleSchema, req.params.role);
  const { widgets } = parseOrThrow(updateLayoutSchema, req.body);
  res.status(200).json(await updateRoleLayout(prisma, role, widgets, req.user!.id));
}
