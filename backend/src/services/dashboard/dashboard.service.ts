import type { PrismaClient } from "../../generated/prisma/client";

import { HttpError } from "../../errors/apiErrors";
import type { AuthUser } from "../../types/express";
import { recordAuditLog } from "../auditLog.service";
import { isPlayerInScope, playerWhere, resolvePlayerScope } from "./scopes";
import { CONFIGURABLE_ROLES, isWidgetKey, WIDGET_KEYS, type ConfigurableRole, type WidgetKey } from "./widgetCatalog";
import { WIDGET_REGISTRY } from "./widgetRegistry";
import type {
  DashboardDto,
  DashboardLayoutsDto,
  RoleLayoutDto,
  SubjectPlayerDto,
  WidgetSummaryDto,
} from "../../contracts/responses";

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
    throw new HttpError("WIDGET_NOT_ENABLED");
  }

  const definition = WIDGET_REGISTRY[key];
  if (definition.subject === "none") {
    return definition.load(prisma, viewer);
  }

  if (!playerId) {
    throw new HttpError("WIDGET_NEEDS_PLAYER");
  }
  const scope = await resolvePlayerScope(prisma, viewer);
  if (!isPlayerInScope(scope, playerId)) {
    throw new HttpError("PLAYER_OUT_OF_SCOPE");
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
  actor: AuthUser,
): Promise<RoleLayoutDto> {
  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRow) {
    throw new HttpError("ROLE_NOT_FOUND", { role });
  }

  // Delete + recreate in one transaction: positions are unique per role,
  // so shifting rows in place would collide mid-update. RN-11: a layout is
  // also a permission (see getWidgetData), so the change is audited in that
  // same transaction, like a role change.
  await prisma.$transaction(async (tx) => {
    await tx.roleWidget.deleteMany({ where: { roleId: roleRow.id } });
    await tx.roleWidget.createMany({
      data: widgets.map((widgetKey, position) => ({ roleId: roleRow.id, widgetKey, position })),
    });
    await recordAuditLog(
      tx,
      actor.id,
      "DASHBOARD_LAYOUT_CHANGED",
      `${role}: ${widgets.length > 0 ? widgets.join(", ") : "—"}`,
    );
  });

  return { role, widgets };
}

export type { DashboardDto, DashboardLayoutsDto, RoleLayoutDto, SubjectPlayerDto, WidgetSummaryDto };
