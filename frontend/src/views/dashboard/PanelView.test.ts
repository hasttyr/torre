import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import PanelView from "./PanelView.vue";

vi.mock("../../services/dashboard", () => ({
  getDashboard: vi.fn(),
  getWidgetData: vi.fn(),
}));

import { getDashboard, getWidgetData } from "../../services/dashboard";

const getDashboardMock = vi.mocked(getDashboard);
const getWidgetDataMock = vi.mocked(getWidgetData);

const SUMMARY = {
  wins: 12,
  draws: 7,
  losses: 8,
  games: 27,
  byes: 1,
  points: 16.5,
  scoreRate: 0.574,
  tournamentsPlayed: 6,
  titles: 1,
  bestFinish: 1,
};

function signIn(role: string, name = "Ana Torres"): void {
  useAuthStore().user = {
    id: "user-1",
    name,
    email: "ana@example.com",
    status: "ACTIVE",
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
    dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
  } as ReturnType<typeof useAuthStore>["user"];
}

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/panel", component: PanelView },
      { path: "/panel/configuracion", component: { template: "<div />" } },
      { path: "/mis-jugadores", component: { template: "<div />" } },
    ],
  });
  router.push("/panel");
  await router.isReady();

  const wrapper = mount(PanelView, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

describe("PanelView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    getWidgetDataMock.mockImplementation(async (key) => (key === "PLAYER_SUMMARY" ? SUMMARY : []));
  });

  it("renders the role's widgets in order and shows a player their own stats without a picker", async () => {
    signIn("PLAYER");
    getDashboardMock.mockResolvedValue({
      widgets: [
        { key: "PLAYER_SUMMARY", subject: "player" },
        { key: "UPCOMING_TOURNAMENTS", subject: "none" },
      ],
      players: [{ id: "self", name: "Ana Torres" }],
    });

    const wrapper = await mountView();

    const rendered = wrapper.findAll("[data-widget]").map((node) => node.attributes("data-widget"));
    expect(rendered).toEqual(["PLAYER_SUMMARY", "UPCOMING_TOURNAMENTS"]);
    expect(getWidgetDataMock).toHaveBeenCalledWith("PLAYER_SUMMARY", "self");
    expect(getWidgetDataMock).toHaveBeenCalledWith("UPCOMING_TOURNAMENTS", undefined);
    expect(wrapper.find("select").exists()).toBe(false);
    expect(wrapper.text()).toContain("57");
    expect(wrapper.text()).not.toContain("Configurar paneles");
  });

  it("lets a coach switch the player shown by every per-player widget", async () => {
    signIn("COACH");
    getDashboardMock.mockResolvedValue({
      widgets: [{ key: "PLAYER_SUMMARY", subject: "player" }],
      players: [
        { id: "p1", name: "Ana Torres" },
        { id: "p2", name: "Luis Gómez" },
      ],
    });

    const wrapper = await mountView();
    expect(getWidgetDataMock).toHaveBeenLastCalledWith("PLAYER_SUMMARY", "p1");

    await wrapper.get("select").setValue("p2");
    await flushPromises();

    expect(getWidgetDataMock).toHaveBeenLastCalledWith("PLAYER_SUMMARY", "p2");
    expect(wrapper.get("[data-widget='PLAYER_SUMMARY']").text()).toContain("Luis Gómez");
  });

  it("tells a coach without linked players where to link them", async () => {
    signIn("COACH");
    getDashboardMock.mockResolvedValue({ widgets: [{ key: "PLAYER_SUMMARY", subject: "player" }], players: [] });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain("Todavía no acompañas a ningún jugador");
    expect(wrapper.find("a[href='/mis-jugadores']").exists()).toBe(true);
    expect(getWidgetDataMock).not.toHaveBeenCalled();
  });

  it("offers the administrator the layout editor", async () => {
    signIn("ADMINISTRATOR");
    getDashboardMock.mockResolvedValue({ widgets: [{ key: "USERS_BY_ROLE", subject: "none" }], players: [] });

    const wrapper = await mountView();

    expect(wrapper.find("a[href='/panel/configuracion']").exists()).toBe(true);
  });

  it("shows an empty state when the role has no widgets, and ignores keys this build can't render", async () => {
    signIn("ARBITER");
    getDashboardMock.mockResolvedValue({
      widgets: [{ key: "FROM_A_NEWER_BACKEND" as never, subject: "none" }],
      players: [],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain("Tu panel todavía no tiene controles");
  });

  it("isolates a failing widget: it shows its own error while the rest still render", async () => {
    signIn("ORGANIZER");
    getDashboardMock.mockResolvedValue({
      widgets: [
        { key: "RECENT_RESULTS", subject: "none" },
        { key: "TOP_PLAYERS", subject: "none" },
      ],
      players: [],
    });
    getWidgetDataMock.mockImplementation(async (key) => {
      if (key === "RECENT_RESULTS") throw new Error("boom");
      return [{ playerId: "p1", name: "Luis Gómez", tournaments: 4, titles: 3, podiums: 3, points: 15.5 }];
    });

    const wrapper = await mountView();

    expect(wrapper.get("[data-widget='RECENT_RESULTS']").text()).toContain("No se pudo cargar este control");
    expect(wrapper.get("[data-widget='TOP_PLAYERS']").text()).toContain("Luis Gómez");
  });
});
