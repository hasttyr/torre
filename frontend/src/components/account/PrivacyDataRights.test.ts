import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { useLocaleStore } from "../../stores/locale";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../../test-support/confirmDialog";
import PrivacyDataRights from "./PrivacyDataRights.vue";

vi.mock("../../services/dataRights", () => ({
  requestDataAccess: vi.fn(),
  requestDataSuppression: vi.fn(),
}));
vi.mock("../../lib/download", () => ({ saveFile: vi.fn() }));

import { saveFile } from "../../lib/download";
import { requestDataAccess, requestDataSuppression } from "../../services/dataRights";

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

  it("gives the consent date in the page's language, not the browser's", async () => {
    const wrapper = await mountPanel();
    useAuthStore().$patch({
      user: { ...USER, dataConsent: { ...USER.dataConsent, date: "2026-03-15T15:00:00.000Z" } },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("15 mar 2026");

    const locale = useLocaleStore();
    await locale.setLocale("en");
    try {
      expect(wrapper.text()).toContain("Mar 15, 2026");
    } finally {
      await locale.setLocale("es");
    }
  });

  it("marks the delete action with the theme's error color, which adapts to dark mode", async () => {
    const wrapper = await mountPanel();
    const remove = wrapper.findAll("button").find((button) => button.text().includes("Eliminar"))!;

    expect(remove.classes()).toContain("text-error");
    expect(remove.classes().some((name) => name.includes("red-"))).toBe(false);
  });

  it("requests data suppression only after the confirm dialog is accepted", async () => {
    mountConfirmDialogHost();
    requestDataSuppressionMock.mockResolvedValue({
      type: "SUPPRESSION",
      status: "RESOLVED",
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
    // Announced by screen readers: the confirmation appears away from focus.
    expect(wrapper.get("[role='status']").text()).toContain("Solicitud procesada");
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

describe("PrivacyDataRights — access right (HU22)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("downloads the titular's own data as a JSON file", async () => {
    vi.mocked(requestDataAccess).mockResolvedValue({ type: "ACCESS", status: "RESOLVED", message: "ok", user: USER });

    const wrapper = await mountPanel();
    await wrapper
      .findAll("button")
      .find((btn) => btn.text().includes("Descargar"))!
      .trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(requestDataAccess).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(saveFile).mock.calls[0];
    expect(filename).toBe("mis-datos-torre.json");
    expect(JSON.parse(await (blob as Blob).text())).toMatchObject({ email: "ana@example.com" });
  });

  it("shows the server's reason when the request is rejected", async () => {
    vi.mocked(requestDataAccess).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Solicitud inválida" } },
    });

    const wrapper = await mountPanel();
    await wrapper
      .findAll("button")
      .find((btn) => btn.text().includes("Descargar"))!
      .trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Solicitud inválida");
    expect(saveFile).not.toHaveBeenCalled();
  });
});
