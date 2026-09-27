import { useQuery, useQueryCache } from "@pinia/colada";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";

vi.mock("../services/dashboard", () => ({ getDashboard: vi.fn(), getWidgetData: vi.fn() }));

import { getDashboard, getWidgetData } from "../services/dashboard";
import { useAuthStore } from "../stores/auth";
import { currentUserId, panelQuery, prefetchPanel, prefetchWidget, widgetQuery } from "./dashboardQueries";

const getDashboardMock = vi.mocked(getDashboard);
const getWidgetDataMock = vi.mocked(getWidgetData);

let pinia: Pinia;

function signIn(id: string): void {
  useAuthStore().$patch({ token: "token", user: { id } as never });
}

describe("dashboard queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    // Installed in an app, as main.ts does: Colada's cache is a Pinia store
    // that reads its defaults from the app.
    createApp({ render: () => null }).use(pinia);
    setActivePinia(pinia);
    getDashboardMock.mockResolvedValue({ widgets: [], players: [] });
  });

  it("keys every entry by the signed-in user, so the next person on a shared computer starts afresh", () => {
    expect(panelQuery("u-1").key).toEqual(["dashboard", "u-1"]);
    expect(widgetQuery("u-1", "PLAYER_SUMMARY", "p1").key).toEqual([
      "dashboard",
      "u-1",
      "widget",
      "PLAYER_SUMMARY",
      "p1",
    ]);
    expect(widgetQuery("u-1", "TOP_PLAYERS", null).key).toEqual(["dashboard", "u-1", "widget", "TOP_PLAYERS", ""]);
    expect(panelQuery("u-2").key).not.toEqual(panelQuery("u-1").key);
  });

  it("keeps an answer 15 s for whoever started it, and doesn't refetch when the tab regains focus", () => {
    for (const options of [panelQuery("u-1"), widgetQuery("u-1", "TOP_PLAYERS", null)]) {
      expect(options.staleTime).toBe(15_000);
      expect(options.refetchOnWindowFocus).toBe(false);
    }
  });

  it("lets the page take the request its route started, instead of a second one", async () => {
    signIn("u-1");
    prefetchPanel();
    const Page = defineComponent({
      setup() {
        const { data } = useQuery(() => panelQuery(currentUserId()));
        return () => h("p", data.value ? "listo" : "cargando");
      },
    });

    const wrapper = mount(Page, { global: { plugins: [pinia] } });
    await flushPromises();

    expect(getDashboardMock).toHaveBeenCalledOnce();
    expect(wrapper.text()).toBe("listo");
  });

  it("asks the server again on every visit, but only once for two visits at the same time", async () => {
    signIn("u-1");

    prefetchPanel();
    prefetchPanel();
    await flushPromises();
    expect(getDashboardMock).toHaveBeenCalledOnce();

    prefetchPanel();
    await flushPromises();
    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });

  it("never serves one user's panel to the next one", async () => {
    signIn("u-1");
    prefetchPanel();
    await flushPromises();

    signIn("u-2");
    prefetchPanel();
    await flushPromises();

    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });

  it("makes no request when nobody is signed in (logout or a session expiring just before)", async () => {
    prefetchPanel();
    prefetchWidget("TOP_PLAYERS", null);
    await flushPromises();

    expect(getDashboardMock).not.toHaveBeenCalled();
    expect(getWidgetDataMock).not.toHaveBeenCalled();
  });

  it("sends a widget's request in the same tick, and keeps a failure in the cache for the widget to show", async () => {
    signIn("u-1");
    getWidgetDataMock.mockRejectedValue(new Error("down"));

    prefetchWidget("TOP_PLAYERS", null);
    expect(getWidgetDataMock).toHaveBeenCalledExactlyOnceWith("TOP_PLAYERS", undefined);

    await flushPromises();
    const entry = useQueryCache().get(widgetQuery("u-1", "TOP_PLAYERS", null).key);
    expect(entry?.state.value.status).toBe("error");
  });
});
