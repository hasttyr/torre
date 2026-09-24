import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../../middlewares/errorHandler";
import type { AuthUser } from "../../types/express";
import { recordAuditLog } from "../auditLog.service";
import { isPlayerInScope, playerWhere, resolvePlayerScope } from "./scopes";
import { CONFIGURABLE_ROLES, isWidgetKey, WIDGET_KEYS, type ConfigurableRole, type WidgetKey } from "./widgetCatalog";
import { WIDGET_REGISTRY } from "./widgetRegistry";

export interface WidgetSummaryDto {
  key: WidgetKey;
  // "player": the widget shows one player the viewer picks on the dashboard.
  subject: "player" | "none";
}

export interface SubjectPlayerDto {
  id: string;
  name: string;
}

export interface DashboardDto {
  widgets: WidgetSummaryDto[];
  // The players the viewer can pick as subject. Empty when none of their
  // widgets needs one (no point querying the directory).
  players: SubjectPlayerDto[];
}

export interface RoleLayoutDto {
  role: ConfigurableRole;
  widgets: WidgetKey[];
}

export interface DashboardLayoutsDto {
  catalog: WidgetSummaryDto[];
  layouts: RoleLayoutDto[];
}

function summarize(key: WidgetKey): WidgetSummaryDto {
  return { key, subject: WIDGET_REGISTRY[key].subject };
}

/** The ordered widget keys a role sees. The administrator always sees the whole catalog. */
async function widgetsForRole(prisma: PrismaClient, role: string): Promise<WidgetKey[]> {
  if (role === "ADMINISTRATOR") {
    return [...WIDGET_KEYS];
  }
  const rows = await prisma.roleWidget.findMany({
    where: { role: { name: role } },
    orderBy: { position: "asc" },
    select: { widgetKey: true },
  });
  // A key removed from the catalog in code may linger in the table until an
  // admin saves that role again; it's skipped rather than breaking the page.
  return rows.map((row) => row.widgetKey).filter(isWidgetKey);
}

/** The current viewer's dashboard: their role's widgets, plus the players they may pick as subject. */
export async function getDashboard(prisma: PrismaClient, viewer: AuthUser): Promise<DashboardDto> {
  const widgets = (await widgetsForRole(prisma, viewer.role)).map(summarize);
  if (!widgets.some((widget) => widget.subject === "player")) {
    return { widgets, players: [] };
  }

  const scope = await resolvePlayerScope(prisma, viewer);
  const players = await prisma.player.findMany({
    where: playerWhere(scope),
    select: { id: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return { widgets, players: players.map((player) => ({ id: player.id, name: player.user.name })) };
}

/**
 * Loads one widget's data for the viewer.
 *
 * @remarks
 * This is where the admin-managed layout becomes an actual permission, not
 * just a UI preference: a widget missing from the viewer's role is refused
 * here even if the client asks for it directly.
 *
 * @throws {HttpError} 403 if the widget isn't enabled for the viewer's role
 * or the player is outside their scope; 400 if a player widget gets no playerId.
 */
export async function getWidgetData(
  prisma: PrismaClient,
  viewer: AuthUser,
  key: WidgetKey,
  playerId: string | undefined,
): Promise<unknown> {
  const enabled = await widgetsForRole(prisma, viewer.role);
  if (!enabled.includes(key)) {
    throw new HttpError(403, "Este control no está habilitado para tu rol");
  }

  const definition = WIDGET_REGISTRY[key];
  if (definition.subject === "none") {
    return definition.load(prisma, viewer);
  }

  if (!playerId) {
    throw new HttpError(400, "Este control necesita un jugador (playerId)");
  }
  const scope = await resolvePlayerScope(prisma, viewer);
  if (!isPlayerInScope(scope, playerId)) {
    throw new HttpError(403, "No tenés acceso a los datos de este jugador");
  }
  return definition.load(prisma, playerId);
}

/** The whole widget catalog and every configurable role's current layout (admin-only). */
export async function listDashboardLayouts(prisma: PrismaClient): Promise<DashboardLayoutsDto> {
  const layouts = await Promise.all(
    CONFIGURABLE_ROLES.map(async (role) => ({ role, widgets: await widgetsForRole(prisma, role) })),
  );
  return { catalog: WIDGET_KEYS.map(summarize), layouts };
}

/**
 * Replaces a role's dashboard layout with `widgets`, in that order (admin-only).
 *
 * @throws {HttpError} 404 if the role isn't in the catalog table.
 */
export async function updateRoleLayout(
  prisma: PrismaClient,
  role: ConfigurableRole,
  widgets: WidgetKey[],
  actingAdminId: string,
): Promise<RoleLayoutDto> {
  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRow) {
    throw new HttpError(404, `El rol "${role}" no existe`);
  }

  // Delete + recreate in one transaction: positions are unique per role,
  // so shifting rows in place would collide mid-update.
  await prisma.$transaction([
    prisma.roleWidget.deleteMany({ where: { roleId: roleRow.id } }),
    prisma.roleWidget.createMany({
      data: widgets.map((widgetKey, position) => ({ roleId: roleRow.id, widgetKey, position })),
    }),
  ]);

  // RN-11: a layout is also a permission (see getWidgetData), so changing
  // it is a critical administrative action like a role change.
  await recordAuditLog(
    prisma,
    actingAdminId,
    "DASHBOARD_LAYOUT_CHANGED",
    `${role}: ${widgets.length > 0 ? widgets.join(", ") : "—"}`,
  );

  return { role, widgets };
}
