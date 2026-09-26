import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import AuditLogView from "./AuditLogView.vue";

vi.mock("../../services/auditLogs", () => ({
  listAuditLogs: vi.fn(),
}));

import { listAuditLogs } from "../../services/auditLogs";

const listAuditLogsMock = vi.mocked(listAuditLogs);

const entry = (id: string) => ({
  id,
  userId: "admin-1",
  userName: "Admin Demo",
  action: "ROLE_CHANGED",
  detail: "Carlos (PLAYER -> ARBITER)",
  createdAt: "2026-09-19T10:00:00.000Z",
});

const loadMore = (wrapper: Awaited<ReturnType<typeof mountView>>["wrapper"]) =>
  wrapper.findAll("button").find((button) => button.text().startsWith("Cargar"));

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/auditoria", component: AuditLogView }],
  });
  router.push("/auditoria");
  await router.isReady();

  const wrapper = mount(AuditLogView, { global: { plugins: [router, i18n] } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper.vm.$nextTick();
  return { wrapper };
}

describe("AuditLogView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows an empty state when there are no entries", async () => {
    listAuditLogsMock.mockResolvedValue({ entries: [], nextCursor: null });

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no hay acciones registradas");
  });

  it("lists audit entries with user, action and detail", async () => {
    listAuditLogsMock.mockResolvedValue({ entries: [entry("log-1")], nextCursor: null });

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Cambio de rol");
    expect(wrapper.text()).not.toContain("ROLE_CHANGED");
    expect(wrapper.text()).toContain("Admin Demo");
    expect(wrapper.text()).toContain("Carlos (PLAYER -> ARBITER)");
    expect(loadMore(wrapper)).toBeUndefined();
  });

  it("loads older entries on demand, one page at a time, until there are no more", async () => {
    listAuditLogsMock
      .mockResolvedValueOnce({ entries: [entry("log-1"), entry("log-2")], nextCursor: "log-2" })
      .mockResolvedValueOnce({ entries: [entry("log-3")], nextCursor: null });
    const { wrapper } = await mountView();
    expect(listAuditLogsMock.mock.calls[0][0]).toBeUndefined();
    expect(wrapper.findAll("li")).toHaveLength(2);

    await loadMore(wrapper)!.trigger("click");
    await flushPromises();

    expect(listAuditLogsMock).toHaveBeenLastCalledWith("log-2");
    expect(wrapper.findAll("li")).toHaveLength(3);
    expect(loadMore(wrapper)).toBeUndefined();
  });

  it("keeps what it shows when an older page fails, and lets the user try that page again", async () => {
    listAuditLogsMock
      .mockResolvedValueOnce({ entries: [entry("log-1")], nextCursor: "log-1" })
      .mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: "Servicio no disponible" } } })
      .mockResolvedValueOnce({ entries: [entry("log-2")], nextCursor: null });
    const { wrapper } = await mountView();

    await loadMore(wrapper)!.trigger("click");
    await flushPromises();
    expect(wrapper.findAll("li")).toHaveLength(1);
    expect(wrapper.get("[role='alert']").text()).toContain("Servicio no disponible");

    await loadMore(wrapper)!.trigger("click");
    await flushPromises();
    expect(listAuditLogsMock).toHaveBeenLastCalledWith("log-1");
    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
  });

  it("shows an error when loading fails", async () => {
    listAuditLogsMock.mockRejectedValue({ isAxiosError: true, response: { data: { error: "No autorizado" } } });

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No autorizado");
  });
});
