import type { ZodType } from "zod";

import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { HttpError } from "../middlewares/errorHandler";
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

/** Parses `input` with `schema`, turning a validation failure into a 400. */
function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

/** GET /dashboard — the current user's widgets and the players they can inspect. */
export const getMine = asyncHandler(async (req, res) => {
  res.status(200).json(await getDashboard(prisma, req.user!));
});

/** GET /dashboard/widgets/:key?playerId= — one widget's data, if the user's role has it. */
export const getWidget = asyncHandler(async (req, res) => {
  const key = parseOrThrow(widgetKeySchema, req.params.key);
  const { playerId } = parseOrThrow(widgetQuerySchema, req.query);
  res.status(200).json(await getWidgetData(prisma, req.user!, key, playerId));
});

/** GET /dashboard/layouts — the widget catalog and every role's layout (admin-only). */
export const listLayouts = asyncHandler(async (_req, res) => {
  res.status(200).json(await listDashboardLayouts(prisma));
});

/** PUT /dashboard/layouts/:role — replaces a role's widgets and their order (admin-only). */
export const updateLayout = asyncHandler(async (req, res) => {
  const role = parseOrThrow(configurableRoleSchema, req.params.role);
  const { widgets } = parseOrThrow(updateLayoutSchema, req.body);
  res.status(200).json(await updateRoleLayout(prisma, role, widgets, req.user!.id));
});
