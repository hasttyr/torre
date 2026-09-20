import { mount } from "@vue/test-utils";
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
    listAuditLogsMock.mockResolvedValue([]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Todavía no hay acciones registradas");
  });

  it("lists audit entries with user, action and detail", async () => {
    listAuditLogsMock.mockResolvedValue([
      {
        id: "log-1",
        userId: "admin-1",
        userName: "Admin Demo",
        action: "ROLE_CHANGED",
        detail: "Carlos (PLAYER -> ARBITER)",
        createdAt: "2026-09-19T10:00:00.000Z",
      },
    ]);

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("Cambio de rol");
    expect(wrapper.text()).not.toContain("ROLE_CHANGED");
    expect(wrapper.text()).toContain("Admin Demo");
    expect(wrapper.text()).toContain("Carlos (PLAYER -> ARBITER)");
  });

  it("shows an error when loading fails", async () => {
    listAuditLogsMock.mockRejectedValue({ isAxiosError: true, response: { data: { error: "No autorizado" } } });

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain("No autorizado");
  });
});
