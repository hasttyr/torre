import type { PrismaClient } from "../generated/prisma/client";
import { ROLES, type ConfigurableRole, type Role, type WidgetKey } from "../contracts/catalogs";

// The data every database needs before anyone can use it, demo or real:
// the role catalog (RF03) and each role's starting dashboard. Written by the
// seed (development) and by scripts/bootstrap.ts (a new production database).

// Starting dashboard per role; the administrator re-composes these from
// /panel/configuracion. ADMINISTRATOR isn't listed: it always sees every widget.
const DEFAULT_LAYOUTS: Record<ConfigurableRole, WidgetKey[]> = {
  PLAYER: [
    "PLAYER_SUMMARY",
    "PLAYER_PERFORMANCE_TREND",
    "PLAYER_RESULTS_BY_COLOR",
    "PLAYER_TOURNAMENT_HISTORY",
    "PLAYER_GAME_LOG",
    "UPCOMING_TOURNAMENTS",
  ],
  COACH: [
    "PLAYERS_OVERVIEW",
    "PLAYER_SUMMARY",
    "PLAYER_PERFORMANCE_TREND",
    "PLAYER_TOURNAMENT_HISTORY",
    "PLAYER_GAME_LOG",
    "UPCOMING_TOURNAMENTS",
  ],
  ARBITER: ["RECENT_RESULTS", "UPCOMING_TOURNAMENTS", "TOP_PLAYERS"],
  ORGANIZER: ["TOURNAMENTS_BY_STATUS", "UPCOMING_TOURNAMENTS", "RECENT_RESULTS", "TOP_PLAYERS"],
};

/** Creates whichever roles are missing, and answers every role's id by name. */
export async function ensureRoles(prisma: PrismaClient): Promise<Map<Role, string>> {
  const roleIdByName = new Map<Role, string>();
  for (const name of ROLES) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roleIdByName.set(name, role.id);
  }
  return roleIdByName;
}

/**
 * Gives each role its default dashboard. Only roles with no layout yet get
 * one, so running it again never overwrites what an admin configured.
 *
 * @returns the roles that got a layout in this run.
 */
export async function ensureDashboardLayouts(
  prisma: PrismaClient,
  roleIdByName: Map<Role, string>,
): Promise<ConfigurableRole[]> {
  const seeded: ConfigurableRole[] = [];

  for (const [role, widgets] of Object.entries(DEFAULT_LAYOUTS) as [ConfigurableRole, WidgetKey[]][]) {
    const roleId = roleIdByName.get(role);
    if (!roleId || (await prisma.roleWidget.count({ where: { roleId } })) > 0) continue;

    await prisma.roleWidget.createMany({
      data: widgets.map((widgetKey, position) => ({ roleId, widgetKey, position })),
    });
    seeded.push(role);
  }

  return seeded;
}
