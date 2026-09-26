import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as adminUsers from "./adminUsers";
import { api } from "./api";
import * as auditLogs from "./auditLogs";
import * as auth from "./auth";
import * as clubs from "./clubs";
import * as coaches from "./coaches";
import * as dashboard from "./dashboard";
import * as dataRights from "./dataRights";
import * as players from "./players";
import * as rounds from "./rounds";
import * as tournaments from "./tournaments";

// Every service function against the exact HTTP call it must make. The
// view tests mock these modules, so without this a wrong URL, verb or body
// would only show up against the real API.

type Verb = "get" | "post" | "put" | "patch" | "delete";

const CASES: [string, () => Promise<unknown>, Verb, string, unknown?][] = [
  [
    "auth.registerUser",
    () => auth.registerUser({ role: "COACH" } as never),
    "post",
    "/auth/register",
    { role: "COACH" },
  ],
  [
    "auth.loginUser",
    () => auth.loginUser({ email: "a@b.co", password: "x" }),
    "post",
    "/auth/login",
    { email: "a@b.co", password: "x" },
  ],
  ["auth.logoutUser", () => auth.logoutUser(), "post", "/auth/logout"],
  ["auth.fetchMe", () => auth.fetchMe(), "get", "/users/me"],
  ["auth.listMyCoaches", () => auth.listMyCoaches(), "get", "/users/me/coaches"],
  ["auth.updateProfile", () => auth.updateProfile({ name: "Ana" }), "put", "/users/me", { name: "Ana" }],
  [
    "auth.requestPasswordReset",
    () => auth.requestPasswordReset("a@b.co"),
    "post",
    "/auth/password/forgot",
    { email: "a@b.co" },
  ],
  [
    "auth.confirmPasswordReset",
    () => auth.confirmPasswordReset("tok", "newpass12"),
    "post",
    "/auth/password/reset",
    { token: "tok", newPassword: "newpass12" },
  ],
  [
    "dataRights.requestDataAccess",
    () => dataRights.requestDataAccess(),
    "post",
    "/users/me/data-requests",
    { type: "ACCESS" },
  ],
  [
    "dataRights.requestDataSuppression",
    () => dataRights.requestDataSuppression("motivo"),
    "post",
    "/users/me/data-requests",
    { type: "SUPPRESSION", reason: "motivo" },
  ],
  ["adminUsers.listUsers", () => adminUsers.listUsers(), "get", "/users"],
  [
    "adminUsers.updateUserRole",
    () => adminUsers.updateUserRole("u-1", "ARBITER"),
    "patch",
    "/users/u-1/role",
    { role: "ARBITER" },
  ],
  [
    "adminUsers.updateUserStatus",
    () => adminUsers.updateUserStatus("u-1", "INACTIVE"),
    "patch",
    "/users/u-1/status",
    { status: "INACTIVE" },
  ],
  ["auditLogs.listAuditLogs", () => auditLogs.listAuditLogs(), "get", "/audit-logs"],
  ["clubs.listClubs", () => clubs.listClubs(), "get", "/clubs"],
  ["clubs.createClub", () => clubs.createClub("Torre"), "post", "/clubs", { name: "Torre" }],
  ["clubs.updateClub", () => clubs.updateClub("c-1", "Torre"), "put", "/clubs/c-1", { name: "Torre" }],
  ["clubs.deleteClub", () => clubs.deleteClub("c-1"), "delete", "/clubs/c-1"],
  ["clubs.listClubPlayers", () => clubs.listClubPlayers("c-1"), "get", "/clubs/c-1/players"],
  [
    "clubs.assignPlayerToClub",
    () => clubs.assignPlayerToClub("c-1", "p-1"),
    "post",
    "/clubs/c-1/players",
    { playerId: "p-1" },
  ],
  ["clubs.removePlayerFromClub", () => clubs.removePlayerFromClub("c-1", "p-1"), "delete", "/clubs/c-1/players/p-1"],
  ["coaches.listLinkedPlayers", () => coaches.listLinkedPlayers(), "get", "/coaches/players"],
  ["coaches.linkPlayer", () => coaches.linkPlayer("p-1"), "post", "/coaches/players", { playerId: "p-1" }],
  ["coaches.unlinkPlayer", () => coaches.unlinkPlayer("p-1"), "delete", "/coaches/players/p-1"],
  ["coaches.listCoachTournaments", () => coaches.listCoachTournaments(), "get", "/coaches/tournaments"],
  ["tournaments.listMyTournaments", () => tournaments.listMyTournaments(), "get", "/tournaments/mine"],
  [
    "tournaments.listAvailableTournaments",
    () => tournaments.listAvailableTournaments(),
    "get",
    "/tournaments/available",
  ],
  ["tournaments.listEnrolledTournaments", () => tournaments.listEnrolledTournaments(), "get", "/tournaments/enrolled"],
  ["tournaments.listLiveTournaments", () => tournaments.listLiveTournaments(), "get", "/tournaments/live"],
  [
    "tournaments.createTournament",
    () => tournaments.createTournament({ name: "Copa", startDate: "2026-10-01", endDate: "2026-10-02" }),
    "post",
    "/tournaments",
    { name: "Copa", startDate: "2026-10-01", endDate: "2026-10-02" },
  ],
  ["tournaments.getTournament", () => tournaments.getTournament("t-1"), "get", "/tournaments/t-1"],
  [
    "tournaments.configureTournament",
    () => tournaments.configureTournament("t-1", { byePoints: 0.5 }),
    "put",
    "/tournaments/t-1/configuration",
    { byePoints: 0.5 },
  ],
  [
    "tournaments.openRegistration",
    () => tournaments.openRegistration("t-1"),
    "post",
    "/tournaments/t-1/registration/open",
  ],
  [
    "tournaments.closeRegistration",
    () => tournaments.closeRegistration("t-1"),
    "post",
    "/tournaments/t-1/registration/close",
  ],
  [
    "tournaments.enrollPlayer",
    () => tournaments.enrollPlayer("t-1", "p-1"),
    "post",
    "/tournaments/t-1/players",
    { playerId: "p-1" },
  ],
  ["tournaments.listEnrolledPlayers", () => tournaments.listEnrolledPlayers("t-1"), "get", "/tournaments/t-1/players"],
  [
    "tournaments.withdrawPlayer (with reason)",
    () => tournaments.withdrawPlayer("t-1", "p-1", "Lesión"),
    "post",
    "/tournaments/t-1/players/p-1/withdraw",
    { reason: "Lesión" },
  ],
  [
    "tournaments.withdrawPlayer (no reason)",
    () => tournaments.withdrawPlayer("t-1", "p-1"),
    "post",
    "/tournaments/t-1/players/p-1/withdraw",
    {},
  ],
  ["tournaments.finishTournament", () => tournaments.finishTournament("t-1"), "post", "/tournaments/t-1/finish"],
  ["rounds.listRounds", () => rounds.listRounds("t-1"), "get", "/tournaments/t-1/rounds"],
  ["rounds.generateRound", () => rounds.generateRound("t-1"), "post", "/tournaments/t-1/rounds"],
  ["rounds.discardRound", () => rounds.discardRound("r-1"), "delete", "/rounds/r-1"],
  [
    "rounds.swapPlayers",
    () => rounds.swapPlayers("r-1", { playerAId: "a", playerBId: "b", reason: "x" }),
    "post",
    "/rounds/r-1/swap",
    { playerAId: "a", playerBId: "b", reason: "x" },
  ],
  ["rounds.publishRound", () => rounds.publishRound("r-1"), "post", "/rounds/r-1/publish"],
  ["rounds.recordResult", () => rounds.recordResult("m-1", "1-0"), "post", "/matches/m-1/result", { value: "1-0" }],
  [
    "rounds.correctResult (with reason)",
    () => rounds.correctResult("m-1", "0-1", "Planilla"),
    "put",
    "/matches/m-1/result",
    { value: "0-1", reason: "Planilla" },
  ],
  [
    "rounds.correctResult (no reason)",
    () => rounds.correctResult("m-1", "0-1"),
    "put",
    "/matches/m-1/result",
    { value: "0-1" },
  ],
  ["rounds.getStandings", () => rounds.getStandings("t-1"), "get", "/tournaments/t-1/standings"],
  ["rounds.getTournamentStats", () => rounds.getTournamentStats("t-1"), "get", "/tournaments/t-1/stats"],
  ["dashboard.getDashboard", () => dashboard.getDashboard(), "get", "/dashboard"],
  ["dashboard.getDashboardLayouts", () => dashboard.getDashboardLayouts(), "get", "/dashboard/layouts"],
  [
    "dashboard.updateRoleLayout",
    () => dashboard.updateRoleLayout("COACH", ["TOP_PLAYERS"]),
    "put",
    "/dashboard/layouts/COACH",
    { widgets: ["TOP_PLAYERS"] },
  ],
];

describe("HTTP services", () => {
  const spies = {} as Record<Verb, ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    for (const verb of ["get", "post", "put", "patch", "delete"] as Verb[]) {
      spies[verb] = vi.spyOn(api, verb).mockResolvedValue({ data: { ok: true } } as never);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(CASES)("%s", async (_name, call, verb, url, body) => {
    await call();

    expect(spies[verb]).toHaveBeenCalledTimes(1);
    const [calledUrl, calledBody] = spies[verb].mock.calls[0];
    expect(calledUrl).toBe(url);
    if (body !== undefined) expect(calledBody).toEqual(body);
  });

  it("returns the response body to the caller", async () => {
    await expect(tournaments.getTournament("t-1")).resolves.toEqual({ ok: true });
  });

  it("sends search, widget and paging parameters as query params, not in the path", async () => {
    await players.searchPlayers("Luis Gómez");
    await dashboard.getWidgetData("PLAYER_SUMMARY", "p-1");
    await dashboard.getWidgetData("TOP_PLAYERS");
    await auditLogs.listAuditLogs();
    await auditLogs.listAuditLogs("log-50");

    expect(spies.get.mock.calls[0]).toEqual(["/players", { params: { q: "Luis Gómez" } }]);
    expect(spies.get.mock.calls[1]).toEqual(["/dashboard/widgets/PLAYER_SUMMARY", { params: { playerId: "p-1" } }]);
    expect(spies.get.mock.calls[2]).toEqual(["/dashboard/widgets/TOP_PLAYERS", { params: {} }]);
    expect(spies.get.mock.calls[3]).toEqual(["/audit-logs", { params: {} }]);
    expect(spies.get.mock.calls[4]).toEqual(["/audit-logs", { params: { cursor: "log-50" } }]);
  });

  it("downloads exports as binary files (HU30)", async () => {
    await rounds.downloadStandingsPdf("t-1");
    await rounds.downloadPairingsPdf("r-1");

    expect(spies.get.mock.calls[0]).toEqual(["/tournaments/t-1/standings.pdf", { responseType: "blob" }]);
    expect(spies.get.mock.calls[1]).toEqual(["/rounds/r-1/pairings.pdf", { responseType: "blob" }]);
  });
});
