import type { PrismaClient } from "@prisma/client";

import type { ConfigurableRole, WidgetKey } from "../../src/services/dashboard/widgetCatalog";

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

/**
 * Seeds each role's default dashboard. Only roles with no layout yet get
 * one, so re-running the seed never overwrites what an admin configured.
 *
 * @returns the roles that got a layout in this run.
 */
export async function seedDashboardLayouts(
  prisma: PrismaClient,
  roleIdByName: Map<string, string>,
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
