import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("../../lib/pageLoad", () => ({ loadPage: vi.fn() }));
vi.mock("../../services/auth", () => ({ logoutUser: vi.fn() }));

import { saveFile } from "../../lib/download";
import { loadPage } from "../../lib/pageLoad";
import { requestDataAccess, requestDataSuppression } from "../../services/dataRights";
import type { RegisteredUser } from "../../services/auth";

const requestDataSuppressionMock = vi.mocked(requestDataSuppression);

const USER: RegisteredUser = {
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
  auth.$patch({ user: USER });

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
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(requestDataSuppressionMock).toHaveBeenCalled();
    // Announced by screen readers: the confirmation appears away from focus.
    expect(wrapper.get("[role='status']").text()).toContain("Solicitud procesada");
  });

  describe("once the data is suppressed", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function suppress() {
      // Time still flows for the dialog; the notice's delay can be skipped.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mountConfirmDialogHost();
      requestDataSuppressionMock.mockResolvedValue({
        type: "SUPPRESSION",
        status: "RESOLVED",
        message: "Los datos personales fueron suprimidos",
        user: USER,
      });
      const wrapper = await mountPanel();
      await wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Eliminar mis datos"))!
        .trigger("click");
      await clickConfirmDialogButton("Eliminar mis datos");
      await flushPromises();
      return wrapper;
    }

    it("signs out for good after the notice has been on screen for a moment", async () => {
      await suppress();
      expect(loadPage).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2500);

      expect(useAuthStore().isAuthenticated).toBe(false);
      expect(loadPage).toHaveBeenCalledWith("/");
    });

    it("signs out right away if the user leaves first, instead of later from another page", async () => {
      const wrapper = await suppress();

      wrapper.unmount();
      await flushPromises();
      expect(loadPage).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(2500);
      expect(loadPage).toHaveBeenCalledOnce();
    });
  });

  it("does not request suppression when the dialog is cancelled", async () => {
    mountConfirmDialogHost();

    const wrapper = await mountPanel();
    const deleteBtn = wrapper.findAll("button").find((btn) => btn.text().includes("Eliminar mis datos"))!;
    await deleteBtn.trigger("click");
    await wrapper.vm.$nextTick();

    await clickConfirmDialogButton("Cancelar");
    await flushPromises();

    expect(requestDataSuppressionMock).not.toHaveBeenCalled();
  });
});

describe("PrivacyDataRights — access right (HU22)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  const EXPORT = {
    profile: USER,
    coaches: [{ name: "Carlos Coach", linkedAt: "2026-02-01T00:00:00.000Z", acceptedAt: null }],
    tournaments: [],
    games: [],
    dataRequests: [],
    auditedActions: [],
  };

  async function download() {
    const wrapper = await mountPanel();
    await wrapper
      .findAll("button")
      .find((btn) => btn.text().includes(i18n.global.t("account.privacyDownloadButton")))!
      .trigger("click");
    await flushPromises();
    return wrapper;
  }

  it("downloads everything held about the person as a JSON file, not just the profile", async () => {
    vi.mocked(requestDataAccess).mockResolvedValue({
      type: "ACCESS",
      status: "RESOLVED",
      message: "ok",
      user: USER,
      data: EXPORT,
    });

    await download();

    expect(requestDataAccess).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(saveFile).mock.calls[0]!;
    expect(filename).toBe("mis-datos-torre.json");
    expect(JSON.parse(await (blob as Blob).text())).toEqual(EXPORT);
  });

  it("names the file in the page's language", async () => {
    vi.mocked(requestDataAccess).mockResolvedValue({
      type: "ACCESS",
      status: "RESOLVED",
      message: "ok",
      user: USER,
      data: EXPORT,
    });
    const locale = useLocaleStore();
    await locale.setLocale("en");
    try {
      await download();
    } finally {
      await locale.setLocale("es");
    }

    expect(vi.mocked(saveFile).mock.calls[0]![1]).toBe("my-torre-data.json");
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
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Solicitud inválida");
    expect(saveFile).not.toHaveBeenCalled();
  });
});
