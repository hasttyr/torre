import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import PrivacyDataRights from "./PrivacyDataRights.vue";

vi.mock("../../services/dataRights", () => ({
  requestDataAccess: vi.fn(),
  requestDataSuppression: vi.fn(),
}));

import { requestDataSuppression } from "../../services/dataRights";

const requestDataSuppressionMock = vi.mocked(requestDataSuppression);

const USER = {
  id: "user-1",
  name: "Ana Torres",
  email: "ana@example.com",
  status: "ACTIVE",
  role: "PLAYER",
  createdAt: "2026-01-01T00:00:00.000Z",
  dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
};

async function mountPanel() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/", component: { template: "<div />" } }],
  });
  router.push("/");
  await router.isReady();

  const auth = useAuthStore();
  auth.$patch({ token: "token", user: USER });

  return mount(PrivacyDataRights, { global: { plugins: [router, i18n] } });
}

describe("PrivacyDataRights", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("requests data suppression only after the confirm dialog is accepted", async () => {
    mountConfirmDialogHost();
    requestDataSuppressionMock.mockResolvedValue({
      type: "SUPRESION",
      status: "RESUELTA",
      message: "Solicitud procesada",
      user: USER,
    });

    const wrapper = await mountPanel();
    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text().includes("Eliminar mis datos"))!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(requestDataSuppressionMock).not.toHaveBeenCalled();

    await clickConfirmDialogButton("Eliminar mis datos");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(requestDataSuppressionMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Solicitud procesada");
  });

  it("does not request suppression when the dialog is cancelled", async () => {
    mountConfirmDialogHost();

    const wrapper = await mountPanel();
    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text().includes("Eliminar mis datos"))!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();

    await clickConfirmDialogButton("Cancelar");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestDataSuppressionMock).not.toHaveBeenCalled();
  });
});
