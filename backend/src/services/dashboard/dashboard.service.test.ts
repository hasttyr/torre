import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../../middlewares/errorHandler";
import { getDashboard, getWidgetData, listDashboardLayouts, updateRoleLayout } from "./dashboard.service";
import { WIDGET_KEYS } from "./widgetCatalog";

vi.mock("./widgetRegistry", () => ({
  WIDGET_REGISTRY: new Proxy(
    {},
    {
      get: (_target, key: string) =>
        key.startsWith("PLAYER_")
          ? { subject: "player", load: vi.fn().mockResolvedValue({ widget: key, subjectData: true }) }
          : { subject: "none", load: vi.fn().mockResolvedValue({ widget: key }) },
    },
  ),
}));

function buildPrismaMock() {
  // Interactive transactions run against a separate "tx" client, so a test
  // can tell writes made inside the transaction from writes made outside it.
  const tx = {
    roleWidget: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
  };
  return {
    tx,
    roleWidget: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    role: { findUnique: vi.fn() },
    player: { findMany: vi.fn(), findUnique: vi.fn() },
    coachPlayer: { findMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
  };
}

type PrismaMock = ReturnType<typeof buildPrismaMock>;
const asClient = (prisma: PrismaMock) => prisma as unknown as PrismaClient;

function layoutRows(...keys: string[]) {
  return keys.map((widgetKey) => ({ widgetKey }));
}

describe("getDashboard", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("gives the administrator the whole catalog with every player as subject", async () => {
    prisma.player.findMany.mockResolvedValue([{ id: "p1", user: { name: "Ana" } }]);

    const dashboard = await getDashboard(asClient(prisma), { id: "admin-1", role: "ADMINISTRATOR" });

    expect(dashboard.widgets.map((widget) => widget.key)).toEqual([...WIDGET_KEYS]);
    expect(prisma.roleWidget.findMany).not.toHaveBeenCalled();
    expect(prisma.player.findMany.mock.calls[0][0].where).toEqual({});
    expect(dashboard.players).toEqual([{ id: "p1", name: "Ana" }]);
  });

  it("returns the role's layout in order and limits a coach's subjects to linked players", async () => {
    prisma.roleWidget.findMany.mockResolvedValue(layoutRows("PLAYERS_OVERVIEW", "PLAYER_SUMMARY"));
    prisma.coachPlayer.findMany.mockResolvedValue([{ playerId: "p1" }]);
    prisma.player.findMany.mockResolvedValue([{ id: "p1", user: { name: "Ana" } }]);

    const dashboard = await getDashboard(asClient(prisma), { id: "coach-1", role: "COACH" });

    expect(dashboard.widgets).toEqual([
      { key: "PLAYERS_OVERVIEW", subject: "none" },
      { key: "PLAYER_SUMMARY", subject: "player" },
    ]);
    expect(prisma.player.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["p1"] } });
  });

  it("skips unknown stored keys and doesn't query players when no widget needs one", async () => {
    prisma.roleWidget.findMany.mockResolvedValue(layoutRows("REMOVED_WIDGET", "RECENT_RESULTS"));

    const dashboard = await getDashboard(asClient(prisma), { id: "arb-1", role: "ARBITER" });

    expect(dashboard).toEqual({ widgets: [{ key: "RECENT_RESULTS", subject: "none" }], players: [] });
    expect(prisma.player.findMany).not.toHaveBeenCalled();
  });
});

describe("getWidgetData", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("refuses a widget that isn't in the viewer's role layout", async () => {
    prisma.roleWidget.findMany.mockResolvedValue(layoutRows("PLAYER_SUMMARY"));

    await expect(
      getWidgetData(asClient(prisma), { id: "u1", role: "PLAYER" }, "USERS_BY_ROLE", undefined),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("requires a playerId for a player widget", async () => {
    prisma.roleWidget.findMany.mockResolvedValue(layoutRows("PLAYER_SUMMARY"));

    await expect(
      getWidgetData(asClient(prisma), { id: "u1", role: "PLAYER" }, "PLAYER_SUMMARY", undefined),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("lets a player read their own data but not somebody else's", async () => {
    prisma.roleWidget.findMany.mockResolvedValue(layoutRows("PLAYER_SUMMARY"));
    prisma.player.findUnique.mockResolvedValue({ id: "own-player" });
    const viewer = { id: "u1", role: "PLAYER" };

    await expect(getWidgetData(asClient(prisma), viewer, "PLAYER_SUMMARY", "own-player")).resolves.toEqual({
      widget: "PLAYER_SUMMARY",
      subjectData: true,
    });
    await expect(getWidgetData(asClient(prisma), viewer, "PLAYER_SUMMARY", "other-player")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("serves any widget to the administrator", async () => {
    await expect(
      getWidgetData(asClient(prisma), { id: "a1", role: "ADMINISTRATOR" }, "USERS_BY_ROLE", undefined),
    ).resolves.toEqual({ widget: "USERS_BY_ROLE" });
  });
});

describe("dashboard layouts", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("lists the catalog and one layout per configurable role (never the administrator)", async () => {
    prisma.roleWidget.findMany.mockResolvedValue([]);

    const result = await listDashboardLayouts(asClient(prisma));

    expect(result.catalog).toHaveLength(WIDGET_KEYS.length);
    expect(result.layouts.map((layout) => layout.role)).toEqual(["PLAYER", "COACH", "ARBITER", "ORGANIZER"]);
  });

  it("replaces a role's layout keeping the given order, and audits it", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "role-coach" });

    const result = await updateRoleLayout(asClient(prisma), "COACH", ["TOP_PLAYERS", "PLAYER_SUMMARY"], "admin-1");

    expect(result).toEqual({ role: "COACH", widgets: ["TOP_PLAYERS", "PLAYER_SUMMARY"] });
    expect(prisma.tx.roleWidget.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "role-coach", widgetKey: "TOP_PLAYERS", position: 0 },
        { roleId: "role-coach", widgetKey: "PLAYER_SUMMARY", position: 1 },
      ],
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // RN-11: audited inside the same transaction as the change.
    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith({
      data: { userId: "admin-1", action: "DASHBOARD_LAYOUT_CHANGED", detail: "COACH: TOP_PLAYERS, PLAYER_SUMMARY" },
      select: { id: true },
    });
  });

  it("responds 404 when the role row doesn't exist", async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(updateRoleLayout(asClient(prisma), "COACH", [], "admin-1")).rejects.toMatchObject({ status: 404 });
  });
});
