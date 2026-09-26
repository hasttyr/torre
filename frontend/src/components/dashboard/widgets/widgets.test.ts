import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type Component } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../../i18n";
import { providePlayerSelection } from "../../../lib/playerSelection";
import GameLogWidget from "./GameLogWidget.vue";
import PerformanceTrendWidget from "./PerformanceTrendWidget.vue";
import PlayersOverviewWidget from "./PlayersOverviewWidget.vue";
import PlayerSummaryWidget from "./PlayerSummaryWidget.vue";
import RecentResultsWidget from "./RecentResultsWidget.vue";
import ResultsByColorWidget from "./ResultsByColorWidget.vue";
import TopPlayersWidget from "./TopPlayersWidget.vue";
import TournamentHistoryWidget from "./TournamentHistoryWidget.vue";
import TournamentsByStatusWidget from "./TournamentsByStatusWidget.vue";
import UpcomingTournamentsWidget from "./UpcomingTournamentsWidget.vue";
import UsersByRoleWidget from "./UsersByRoleWidget.vue";

vi.mock("../../../services/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../services/dashboard")>()),
  getWidgetData: vi.fn(),
}));

import { getWidgetData } from "../../../services/dashboard";

const getWidgetDataMock = vi.mocked(getWidgetData);

const PLAYERS = [
  { id: "p1", name: "Ana Torres" },
  { id: "p2", name: "Luis Gómez" },
];

/** Mounts a widget the way the dashboard does: inside a provided player selection. */
async function mountWidget(widget: Component, options: { selected?: string | null; playerWidgets?: boolean } = {}) {
  let selection!: ReturnType<typeof providePlayerSelection>;
  const Host = defineComponent({
    setup() {
      selection = providePlayerSelection({ hasPlayerWidgets: () => options.playerWidgets ?? true });
      selection.players.value = PLAYERS;
      selection.selectedId.value = options.selected === undefined ? "p1" : options.selected;
      return () => h(widget);
    },
  });
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  const wrapper = mount(Host, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return { wrapper, selection };
}

describe("dashboard widgets", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("player widgets ask for the selected player and show whose data it is", async () => {
    getWidgetDataMock.mockResolvedValue({
      wins: 3,
      draws: 1,
      losses: 1,
      games: 5,
      byes: 0,
      points: 3.5,
      scoreRate: 0.7,
      tournamentsPlayed: 2,
      titles: 1,
      bestFinish: 1,
    });

    const { wrapper } = await mountWidget(PlayerSummaryWidget);

    expect(getWidgetDataMock).toHaveBeenCalledWith("PLAYER_SUMMARY", "p1");
    expect(wrapper.text()).toContain("Ana Torres");
    expect(wrapper.text()).toContain("70");
    expect(wrapper.text()).toContain("1.º");
  });

  it("sets numbers in tabular figures, so they line up across tiles and rows", async () => {
    getWidgetDataMock.mockResolvedValue({
      wins: 3,
      draws: 1,
      losses: 1,
      games: 5,
      byes: 0,
      points: 3.5,
      scoreRate: 0.7,
      tournamentsPlayed: 2,
      titles: 1,
      bestFinish: 1,
    });
    const summary = await mountWidget(PlayerSummaryWidget);
    // Each term's first description is its number (a second one is a hint).
    const values = summary.wrapper.findAll("dt + dd");
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => value.classes("tabular-nums"))).toBe(true);

    getWidgetDataMock.mockResolvedValue([
      {
        tournamentId: "t1",
        name: "Copa",
        startDate: "2026-03-01",
        endDate: "2026-03-02",
        status: "FINISHED",
        withdrawn: false,
        rank: 1,
        participants: 8,
        points: 4.5,
        buchholz: 12,
      },
    ]);
    const history = await mountWidget(TournamentHistoryWidget);
    const cells = history.wrapper.findAll("tbody td");
    expect(cells.at(-2)!.get("span").classes()).toContain("tabular-nums");
    expect(cells.at(-1)!.get("span").classes()).toContain("tabular-nums");
  });

  it("player widgets don't request anything until a player is picked", async () => {
    const { wrapper } = await mountWidget(PlayerSummaryWidget, { selected: null });

    expect(getWidgetDataMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Elige un jugador");
  });

  it("reloads when the dashboard's subject changes, ignoring a slower earlier answer", async () => {
    let resolveFirst!: (value: unknown) => void;
    getWidgetDataMock
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({
        white: { wins: 0, draws: 0, losses: 2, scoreRate: 0 },
        black: { wins: 1, draws: 0, losses: 0, scoreRate: 1 },
      });

    const { wrapper, selection } = await mountWidget(ResultsByColorWidget);
    selection.selectedId.value = "p2";
    await flushPromises();
    // The first request (for p1) resolves last: it must not overwrite p2's data.
    resolveFirst({
      white: { wins: 9, draws: 0, losses: 0, scoreRate: 1 },
      black: { wins: 9, draws: 0, losses: 0, scoreRate: 1 },
    });
    await flushPromises();

    expect(getWidgetDataMock).toHaveBeenLastCalledWith("PLAYER_RESULTS_BY_COLOR", "p2");
    expect(wrapper.text()).toContain("0 V · 0 T · 2 D");
    expect(wrapper.text()).not.toContain("9 V");
  });

  it("shows an error with a retry that asks again", async () => {
    getWidgetDataMock.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([]);

    const { wrapper } = await mountWidget(TopPlayersWidget);
    expect(wrapper.text()).toContain("No se pudo cargar este control");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Reintentar")!
      .trigger("click");
    await flushPromises();

    expect(getWidgetDataMock).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("Todavía no hay torneos finalizados");
  });

  it("performance trend plots one point per tournament", async () => {
    getWidgetDataMock.mockResolvedValue([
      {
        tournamentId: "t1",
        name: "Copa",
        startDate: "2026-03-01",
        scoreRate: 0.5,
        points: 2.5,
        games: 5,
        rank: 3,
        participants: 8,
      },
      {
        tournamentId: "t2",
        name: "Liga",
        startDate: "2026-06-01",
        scoreRate: 0.8,
        points: 4,
        games: 5,
        rank: 1,
        participants: 9,
      },
    ]);

    const { wrapper } = await mountWidget(PerformanceTrendWidget);

    expect(wrapper.findAll("circle")).toHaveLength(2);
    expect(wrapper.text()).toContain("80");
  });

  it("tournament history and game log list the player's records", async () => {
    getWidgetDataMock.mockResolvedValueOnce([
      {
        tournamentId: "t1",
        name: "Copa Otoño",
        startDate: "2025-10-17",
        endDate: "2025-10-19",
        status: "FINISHED",
        withdrawn: false,
        rank: 2,
        participants: 9,
        points: 3.5,
        buchholz: 14,
      },
    ]);
    const history = await mountWidget(TournamentHistoryWidget);
    expect(history.wrapper.text()).toContain("Copa Otoño");
    expect(history.wrapper.text()).toContain("2.º");

    getWidgetDataMock.mockResolvedValueOnce([
      {
        matchId: "m1",
        tournamentId: "t1",
        tournamentName: "Liga",
        round: 3,
        color: "BLACK",
        opponent: "Carlos Ruiz",
        outcome: "WIN",
        recordedAt: "2026-09-23T15:00:00Z",
      },
      {
        matchId: "m2",
        tournamentId: "t1",
        tournamentName: "Liga",
        round: 2,
        color: null,
        opponent: null,
        outcome: "BYE",
        recordedAt: "2026-09-21T15:00:00Z",
      },
    ]);
    const log = await mountWidget(GameLogWidget);
    expect(log.wrapper.text()).toContain("Carlos Ruiz");
    expect(log.wrapper.text()).toContain("Negras");
    expect(log.wrapper.text()).toContain("Victoria");
    expect(log.wrapper.text()).toContain("Bye");
  });

  it("the game log dates each game by the viewer's day, not UTC's", async () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Bogota";
    try {
      getWidgetDataMock.mockResolvedValue([
        {
          matchId: "m1",
          tournamentId: "t1",
          tournamentName: "Liga",
          round: 1,
          color: "WHITE",
          opponent: "Carlos Ruiz",
          outcome: "DRAW",
          recordedAt: "2026-09-24T01:00:00Z", // 23 Sep, 20:00 in Bogotá
        },
      ]);

      const { wrapper } = await mountWidget(GameLogWidget);

      expect(wrapper.text()).toContain("23 sept 2026");
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });

  it("clicking a player in the overview makes them the dashboard's subject", async () => {
    getWidgetDataMock.mockResolvedValue([
      {
        playerId: "p2",
        name: "Luis Gómez",
        program: "Sistemas",
        tournaments: 3,
        wins: 5,
        draws: 1,
        losses: 2,
        games: 8,
        byes: 0,
        points: 5.5,
        scoreRate: 0.69,
      },
    ]);

    const { wrapper, selection } = await mountWidget(PlayersOverviewWidget);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Luis Gómez")!
      .trigger("click");

    expect(selection.selectedId.value).toBe("p2");
  });

  it("names in lists are plain text when there are no player widgets to drive", async () => {
    getWidgetDataMock.mockResolvedValue([
      { playerId: "p2", name: "Luis Gómez", tournaments: 4, titles: 2, podiums: 3, points: 12 },
    ]);

    const { wrapper } = await mountWidget(TopPlayersWidget, { playerWidgets: false });

    expect(wrapper.text()).toContain("Luis Gómez");
    expect(wrapper.findAll("button").some((button) => button.text() === "Luis Gómez")).toBe(false);
  });

  it("tournament widgets: status counts, upcoming (with a link to follow one in play) and recent results", async () => {
    getWidgetDataMock.mockResolvedValueOnce([
      { status: "IN_PROGRESS", count: 2 },
      { status: "FINISHED", count: 5 },
    ]);
    const status = await mountWidget(TournamentsByStatusWidget);
    expect(status.wrapper.text()).toContain("7");
    expect(status.wrapper.text()).toContain("En curso");

    getWidgetDataMock.mockResolvedValueOnce([
      { id: "t1", name: "Liga", startDate: "2026-09-19", endDate: "2026-09-26", status: "IN_PROGRESS", enrolled: 10 },
      {
        id: "t2",
        name: "Copa",
        startDate: "2026-10-15",
        endDate: "2026-10-17",
        status: "REGISTRATION_OPEN",
        enrolled: 1,
      },
    ]);
    const upcoming = await mountWidget(UpcomingTournamentsWidget);
    expect(upcoming.wrapper.find("a[href='/torneos/t1/sala']").exists()).toBe(true);
    expect(upcoming.wrapper.find("a[href='/torneos/t2/sala']").exists()).toBe(false);
    expect(upcoming.wrapper.text()).toContain("10 inscritos");
    expect(upcoming.wrapper.text()).toContain("1 inscrito");

    getWidgetDataMock.mockResolvedValueOnce([
      {
        id: "r1",
        tournamentName: "Liga",
        round: 4,
        board: 2,
        white: "Ana",
        black: "Luis",
        value: "0-1",
        recordedAt: "2026-09-23T15:00:00Z",
      },
    ]);
    const recent = await mountWidget(RecentResultsWidget);
    expect(recent.wrapper.text()).toContain("0 – 1");
    expect(recent.wrapper.text()).toContain("Ronda 4");
  });

  it("users by role counts active accounts and notes inactive ones", async () => {
    getWidgetDataMock.mockResolvedValue([
      { role: "PLAYER", active: 12, inactive: 2 },
      { role: "COACH", active: 2, inactive: 0 },
    ]);

    const { wrapper } = await mountWidget(UsersByRoleWidget);

    expect(wrapper.text()).toContain("14");
    expect(wrapper.text()).toContain("2 inactivas");
  });
});
