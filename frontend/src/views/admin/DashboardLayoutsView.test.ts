import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import DashboardLayoutsView from "./DashboardLayoutsView.vue";

vi.mock("../../services/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/dashboard")>()),
  getDashboardLayouts: vi.fn(),
  updateRoleLayout: vi.fn(),
}));

import { getDashboardLayouts, updateRoleLayout } from "../../services/dashboard";

const getLayoutsMock = vi.mocked(getDashboardLayouts);
const updateLayoutMock = vi.mocked(updateRoleLayout);

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/panel/configuracion", component: DashboardLayoutsView },
      { path: "/panel", component: { template: "<div />" } },
    ],
  });
  router.push("/panel/configuracion");
  await router.isReady();

  const wrapper = mount(DashboardLayoutsView, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return wrapper;
}

const panelOrder = (wrapper: Awaited<ReturnType<typeof mountView>>) =>
  wrapper.findAll("[data-widget]").map((node) => node.attributes("data-widget"));

describe("DashboardLayoutsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    getLayoutsMock.mockResolvedValue({
      catalog: [
        { key: "PLAYER_SUMMARY", subject: "player" },
        { key: "TOP_PLAYERS", subject: "none" },
        { key: "RECENT_RESULTS", subject: "none" },
      ],
      layouts: [
        { role: "PLAYER", widgets: ["PLAYER_SUMMARY", "TOP_PLAYERS"] },
        { role: "COACH", widgets: [] },
        { role: "ARBITER", widgets: ["RECENT_RESULTS"] },
        { role: "ORGANIZER", widgets: [] },
      ],
    });
  });

  it("shows the selected role's widgets and only the missing ones in the catalog", async () => {
    const wrapper = await mountView();

    expect(panelOrder(wrapper)).toEqual(["PLAYER_SUMMARY", "TOP_PLAYERS"]);
    expect(wrapper.findAll("[data-available]").map((node) => node.attributes("data-available"))).toEqual([
      "RECENT_RESULTS",
    ]);
  });

  it("adds, reorders and saves a role's layout in the chosen order", async () => {
    updateLayoutMock.mockImplementation(async (role, widgets) => ({ role, widgets }));
    const wrapper = await mountView();

    await wrapper.get("[data-available='RECENT_RESULTS'] button").trigger("click");
    await wrapper.get("[data-widget='RECENT_RESULTS'] button[aria-label^='Subir']").trigger("click");
    expect(panelOrder(wrapper)).toEqual(["PLAYER_SUMMARY", "RECENT_RESULTS", "TOP_PLAYERS"]);

    const saveButton = wrapper.findAll("button").find((button) => button.text() === "Guardar panel");
    await saveButton!.trigger("click");
    await flushPromises();

    expect(updateLayoutMock).toHaveBeenCalledWith("PLAYER", ["PLAYER_SUMMARY", "RECENT_RESULTS", "TOP_PLAYERS"]);
    expect(wrapper.text()).toContain("Panel de Jugador guardado.");
    expect(wrapper.findAll("button").some((button) => button.text() === "Guardar panel")).toBe(false);
  });

  it("keeps a separate draft per role and discards only the active one", async () => {
    const wrapper = await mountView();

    await wrapper.get("[data-widget='TOP_PLAYERS'] button[aria-label^='Quitar']").trigger("click");
    const coachTab = wrapper.findAll("[role='tab']").find((tab) => tab.text().startsWith("Entrenador"));
    await coachTab!.trigger("click");
    expect(panelOrder(wrapper)).toEqual([]);

    const playerTab = wrapper.findAll("[role='tab']").find((tab) => tab.text().startsWith("Jugador"));
    await playerTab!.trigger("click");
    expect(panelOrder(wrapper)).toEqual(["PLAYER_SUMMARY"]);

    const discard = wrapper.findAll("button").find((button) => button.text() === "Descartar");
    await discard!.trigger("click");
    expect(panelOrder(wrapper)).toEqual(["PLAYER_SUMMARY", "TOP_PLAYERS"]);
    expect(updateLayoutMock).not.toHaveBeenCalled();
  });

  it("shows the server's error when saving fails", async () => {
    updateLayoutMock.mockRejectedValue({ isAxiosError: true, response: { data: { error: "Rol inválido" } } });
    const wrapper = await mountView();

    await wrapper.get("[data-widget='TOP_PLAYERS'] button[aria-label^='Quitar']").trigger("click");
    const saveButton = wrapper.findAll("button").find((button) => button.text() === "Guardar panel");
    await saveButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Rol inválido");
  });
});
