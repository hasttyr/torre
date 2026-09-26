import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import DashboardLayoutsView from "./DashboardLayoutsView.vue";

vi.mock("../../services/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/dashboard")>()),
  getDashboardLayouts: vi.fn(),
  updateRoleLayout: vi.fn(),
}));

import { getDashboardLayouts, updateRoleLayout } from "../../services/dashboard";

const getLayoutsMock = vi.mocked(getDashboardLayouts);
const updateLayoutMock = vi.mocked(updateRoleLayout);

enableAutoUnmount(afterEach);

// attachTo: arrow-key navigation moves real focus, which jsdom only tracks for attached nodes.
async function mountView(url = "/panel/configuracion") {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/panel/configuracion", component: DashboardLayoutsView },
      { path: "/panel", component: { template: "<div />" } },
    ],
  });
  router.push(url);
  await router.isReady();

  const wrapper = mount(DashboardLayoutsView, { global: { plugins: [router, i18n] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

type View = Awaited<ReturnType<typeof mountView>>;

const panelOrder = (wrapper: View) => wrapper.findAll("[data-widget]").map((node) => node.attributes("data-widget"));

const tab = (wrapper: View, role: string) =>
  wrapper.findAll("[role='tab']").find((node) => node.text().startsWith(role))!;

/** Picks a role's tab with the mouse: like native tabs, they switch on press, not on release. */
async function selectTab(wrapper: View, role: string): Promise<void> {
  await tab(wrapper, role).trigger("mousedown");
  // The selected role lives in the URL: let the navigation land.
  await flushPromises();
}

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

  describe("keeps keyboard focus on the list while its items move", () => {
    const focused = () => document.activeElement as HTMLElement;
    const inRow = (row: string) => focused().closest(row)?.getAttribute(row.slice(1, -1));
    const press = async (wrapper: View, selector: string) => {
      const button = wrapper.get<HTMLButtonElement>(selector);
      button.element.focus();
      await button.trigger("click");
      await flushPromises();
    };

    it("after removing a widget, on the next one's remove button, else the widget back in the catalog", async () => {
      const wrapper = await mountView();

      await press(wrapper, "[data-widget='PLAYER_SUMMARY'] [data-action='remove']");
      expect(inRow("[data-widget]")).toBe("TOP_PLAYERS");
      expect(focused().dataset.action).toBe("remove");

      await press(wrapper, "[data-widget='TOP_PLAYERS'] [data-action='remove']");
      expect(inRow("[data-available]")).toBe("TOP_PLAYERS");
    });

    it("after adding one, on the catalog's next add button, else the widget in the panel", async () => {
      getLayoutsMock.mockResolvedValue({
        catalog: [
          { key: "TOP_PLAYERS", subject: "none" },
          { key: "RECENT_RESULTS", subject: "none" },
        ],
        layouts: [{ role: "PLAYER", widgets: [] }],
      });
      const wrapper = await mountView();

      await press(wrapper, "[data-available='TOP_PLAYERS'] button");
      expect(inRow("[data-available]")).toBe("RECENT_RESULTS");

      await press(wrapper, "[data-available='RECENT_RESULTS'] button");
      expect(inRow("[data-widget]")).toBe("RECENT_RESULTS");
    });

    it("after moving one, on the same widget, switching direction at the end of the list", async () => {
      const wrapper = await mountView();

      await press(wrapper, "[data-widget='TOP_PLAYERS'] [data-action='up']");

      expect(panelOrder(wrapper)).toEqual(["TOP_PLAYERS", "PLAYER_SUMMARY"]);
      expect(inRow("[data-widget]")).toBe("TOP_PLAYERS");
      // Now first, its "up" is disabled: focus lands on "down".
      expect(focused().dataset.action).toBe("down");
    });
  });

  it("keeps a separate draft per role and discards only the active one", async () => {
    const wrapper = await mountView();

    await wrapper.get("[data-widget='TOP_PLAYERS'] button[aria-label^='Quitar']").trigger("click");
    await selectTab(wrapper, "Entrenador");
    expect(panelOrder(wrapper)).toEqual([]);

    await selectTab(wrapper, "Jugador");
    expect(panelOrder(wrapper)).toEqual(["PLAYER_SUMMARY"]);

    const discard = wrapper.findAll("button").find((button) => button.text() === "Descartar");
    await discard!.trigger("click");
    expect(panelOrder(wrapper)).toEqual(["PLAYER_SUMMARY", "TOP_PLAYERS"]);
    expect(updateLayoutMock).not.toHaveBeenCalled();
  });

  it("switches roles from the keyboard, with the layout as the selected tab's panel", async () => {
    const wrapper = await mountView();
    // Tabbing into the list lands on the selected tab.
    (wrapper.get("[role='tablist']").element as HTMLElement).focus();
    await flushPromises();
    expect(document.activeElement).toBe(tab(wrapper, "Jugador").element);

    await tab(wrapper, "Jugador").trigger("keydown", { key: "ArrowRight" });
    await flushPromises();

    expect(tab(wrapper, "Entrenador").attributes("aria-selected")).toBe("true");
    expect(panelOrder(wrapper)).toEqual([]);
    const panel = wrapper.get("[role='tabpanel']:not([hidden])");
    expect(panel.attributes("aria-labelledby")).toBe(tab(wrapper, "Entrenador").attributes("id"));
  });

  it("keeps the selected role in the URL, and opens the role a shared link points to", async () => {
    const wrapper = await mountView();

    await selectTab(wrapper, "Árbitro");
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({ rol: "ARBITER" });
    await selectTab(wrapper, "Jugador");
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({});

    const linked = await mountView("/panel/configuracion?rol=ARBITER");
    expect(tab(linked, "Árbitro").attributes("aria-selected")).toBe("true");
    expect(panelOrder(linked)).toEqual(["RECENT_RESULTS"]);
  });

  it("marks a role with unsaved changes in its tab's text, which screen readers read", async () => {
    const wrapper = await mountView();

    await wrapper.get("[data-widget='TOP_PLAYERS'] button[aria-label^='Quitar']").trigger("click");

    expect(tab(wrapper, "Jugador").text()).toContain("Cambios sin guardar");
    expect(tab(wrapper, "Jugador").findAll("[aria-label]")).toHaveLength(0);
  });

  it("warns about unsaved dashboards before leaving the page", async () => {
    mountConfirmDialogHost();
    // Through <RouterView>, as the app does: route-leave guards only run there.
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: "/panel/configuracion", component: DashboardLayoutsView },
        { path: "/panel", component: { template: "<div />" } },
      ],
    });
    await router.push("/panel/configuracion");
    const wrapper = mount({ template: "<RouterView />" }, { global: { plugins: [router, i18n] } });
    await flushPromises();

    await wrapper.get("[data-widget='TOP_PLAYERS'] button[aria-label^='Quitar']").trigger("click");
    const navigation = router.push("/panel");
    await flushPromises();
    expect(document.body.textContent).toContain("Hay paneles con cambios sin guardar");
    await clickConfirmDialogButton("Salir sin guardar");
    await navigation;

    expect(router.currentRoute.value.path).toBe("/panel");
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
