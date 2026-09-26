import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import { useAuthStore } from "../stores/auth";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../test-support/confirmDialog";
import AccountView from "./AccountView.vue";

vi.mock("../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth")>();
  return {
    ...actual,
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    fetchMe: vi.fn(),
    updateProfile: vi.fn(),
    listMyCoaches: vi.fn(),
  };
});

import { fetchMe, listMyCoaches, updateProfile } from "../services/auth";

const fetchMeMock = vi.mocked(fetchMe);
const updateProfileMock = vi.mocked(updateProfile);
const listMyCoachesMock = vi.mocked(listMyCoaches);

const DATA_CONSENT = { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" };

const USER = {
  id: "user-1",
  name: "Ana Torres",
  email: "ana@example.com",
  status: "ACTIVE",
  role: "ORGANIZER",
  createdAt: "2026-01-01T00:00:00.000Z",
  dataConsent: DATA_CONSENT,
};

const PLAYER = {
  id: "user-2",
  name: "Luis Gómez",
  email: "luis@example.com",
  status: "ACTIVE",
  role: "PLAYER",
  createdAt: "2026-01-01T00:00:00.000Z",
  dataConsent: DATA_CONSENT,
  player: {
    universityCode: "U1",
    program: "Sistemas",
    semester: 5,
    birthDate: null,
    age: null,
    gender: null,
    disability: null,
    club: null,
  },
};

async function mountAccountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/login", component: { template: "<div />" } },
      { path: "/cuenta", component: { template: "<div />" } },
    ],
  });
  router.push("/cuenta");
  await router.isReady();

  // attachTo: a failed submit moves focus, which jsdom only tracks for attached nodes.
  const wrapper = mount(AccountView, { global: { plugins: [router, i18n] }, attachTo: document.body });
  // The date picker is its own chunk: let it replace its placeholder.
  await vi.dynamicImportSettled();
  await flushPromises();
  return wrapper;
}

enableAutoUnmount(afterEach);

/** Mounts the view through <RouterView>, as the app does: route-leave guards only run there. */
async function mountRouted() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/cuenta", component: AccountView },
    ],
  });
  await router.push("/cuenta");
  const wrapper = mount({ template: "<RouterView />" }, { global: { plugins: [router, i18n] } });
  await vi.dynamicImportSettled();
  await flushPromises();
  return { wrapper, router };
}

describe("AccountView — leaving with unsaved changes", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    listMyCoachesMock.mockResolvedValue([]);
    useAuthStore().$patch({ token: "token", user: PLAYER });
    fetchMeMock.mockResolvedValue(PLAYER);
  });

  it("lets the user leave while the profile is as saved", async () => {
    const { router } = await mountRouted();

    await router.push("/");

    expect(router.currentRoute.value.path).toBe("/");
  });

  it("asks before leaving with an edited field", async () => {
    mountConfirmDialogHost();
    const { wrapper, router } = await mountRouted();

    await wrapper.get("#program").setValue("Medicina");
    const navigation = router.push("/");
    await flushPromises();
    expect(document.body.textContent).toContain("Tienes cambios sin guardar");
    await clickConfirmDialogButton("Cancelar");
    await navigation;

    expect(router.currentRoute.value.path).toBe("/cuenta");
  });

  it("doesn't ask once the edit is saved", async () => {
    const saved = { ...PLAYER, player: { ...PLAYER.player, program: "Medicina" } };
    updateProfileMock.mockResolvedValue(saved);
    const { wrapper, router } = await mountRouted();

    await wrapper.get("#program").setValue("Medicina");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();
    await router.push("/");

    expect(router.currentRoute.value.path).toBe("/");
  });
});

describe("AccountView", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    listMyCoachesMock.mockResolvedValue([]);
  });

  it("shows the user data saved in the store while refreshing the profile", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USER });
    fetchMeMock.mockResolvedValue(USER);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.get("#name").element as HTMLInputElement).value).toBe("Ana Torres");
    expect(wrapper.text()).toContain("ana@example.com");
    expect(wrapper.text()).toContain("Organizador");
  });

  it("shows a notice when refreshing the profile fails, without losing the already loaded data", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USER });
    fetchMeMock.mockRejectedValue(new Error("Network Error"));

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudo actualizar tu perfil");
    expect((wrapper.get("#name").element as HTMLInputElement).value).toBe("Ana Torres");
  });

  it("does not show player fields for a user without that profile", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USER });
    fetchMeMock.mockResolvedValue(USER);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.find("#universityCode").exists()).toBe(false);
  });

  it("preloads player fields when the user has that profile", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: PLAYER });
    fetchMeMock.mockResolvedValue(PLAYER);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.get("#universityCode").element as HTMLInputElement).value).toBe("U1");
    expect((wrapper.get("#program").element as HTMLInputElement).value).toBe("Sistemas");
    expect((wrapper.get("#semester").element as HTMLInputElement).value).toBe("5");
  });

  it("preloads birth date/gender/disability and shows the calculated age", async () => {
    const auth = useAuthStore();
    const playerWithData = {
      ...PLAYER,
      player: {
        ...PLAYER.player,
        birthDate: "2005-06-15T00:00:00.000Z",
        age: 21,
        gender: "FEMALE" as const,
        disability: "VISUAL" as const,
      },
    };
    auth.$patch({ token: "token", user: playerWithData });
    fetchMeMock.mockResolvedValue(playerWithData);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.get("#birthDate").element as HTMLInputElement).value).toBe("15/06/2005");
    expect((wrapper.get("#gender").element as HTMLSelectElement).value).toBe("FEMALE");
    expect((wrapper.get("#disability").element as HTMLSelectElement).value).toBe("VISUAL");
    expect(wrapper.text()).toContain("Edad actual: 21 años");
  });

  it("only offers gender and disability from the closed catalog (no free-text input)", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: PLAYER });
    fetchMeMock.mockResolvedValue(PLAYER);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.get("#gender").element.tagName).toBe("SELECT");
    expect(wrapper.get("#disability").element.tagName).toBe("SELECT");
    expect(wrapper.findAll("#gender option").length).toBeGreaterThan(1);
  });

  it("sends fechaNacimiento/genero/discapacidad when saving (HU20)", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: PLAYER });
    fetchMeMock.mockResolvedValue(PLAYER);
    updateProfileMock.mockResolvedValue(PLAYER);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("#birthDate").setValue("15/06/2005");
    await wrapper.get("#birthDate").trigger("blur");
    await wrapper.get("#gender").setValue("FEMALE");
    await wrapper.get("#disability").setValue("VISUAL");
    await wrapper.get("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        birthDate: "2005-06-15",
        gender: "FEMALE",
        disability: "VISUAL",
      }),
    );
  });

  it("doesn't take tomorrow as a birth date in the evening, when UTC is already on the next day", async () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Bogota";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-26T01:30:00.000Z")); // 25 Sep, 20:30 in Bogotá
    try {
      const auth = useAuthStore();
      auth.$patch({ token: "token", user: PLAYER });
      fetchMeMock.mockResolvedValue(PLAYER);
      updateProfileMock.mockResolvedValue(PLAYER);

      const wrapper = await mountAccountView();
      await new Promise((resolve) => setTimeout(resolve, 0));

      await wrapper.get("#birthDate").setValue("26/09/2026");
      await wrapper.get("#birthDate").trigger("blur");
      await wrapper.get("form").trigger("submit.prevent");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(updateProfileMock).not.toHaveBeenCalledWith(expect.objectContaining({ birthDate: "2026-09-26" }));
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTimeZone;
    }
  });

  it("ties profile errors to their field and takes the user to the first one", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: PLAYER });
    fetchMeMock.mockResolvedValue(PLAYER);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("#name").setValue("A");
    await wrapper.get("#program").setValue("");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(updateProfileMock).not.toHaveBeenCalled();
    expect(wrapper.get("#name").attributes("aria-describedby")).toBe("name-error");
    expect(wrapper.get("#program").attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(wrapper.get("#name").element);
    expect(wrapper.get("#universityCode").attributes()).toMatchObject({ autocomplete: "off", spellcheck: "false" });
  });

  it("saves profile changes and shows a success message (HU20)", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USER });
    fetchMeMock.mockResolvedValue(USER);
    updateProfileMock.mockResolvedValue({ ...USER, name: "Ana T." });

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("#name").setValue("Ana T.");
    await wrapper.get("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(updateProfileMock).toHaveBeenCalledWith({ name: "Ana T." });
    expect(wrapper.get("[role='status']").text()).toContain("Perfil actualizado");
  });

  it("shows the player's club and linked coaches (HU23/HU24)", async () => {
    const auth = useAuthStore();
    const playerWithClub = {
      ...PLAYER,
      player: { ...PLAYER.player, club: { id: "club-1", name: "Club Ajedrez Central" } },
    };
    auth.$patch({ token: "token", user: playerWithClub });
    fetchMeMock.mockResolvedValue(playerWithClub);
    listMyCoachesMock.mockResolvedValue([{ id: "coach-1", name: "Marta Ríos", email: "marta@example.com" }]);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Club Ajedrez Central");
    expect(wrapper.text()).toContain("Marta Ríos");
  });

  it("shows an empty-state message when the player has no club or coaches", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: PLAYER });
    fetchMeMock.mockResolvedValue(PLAYER);
    listMyCoachesMock.mockResolvedValue([]);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Sin club asignado");
    expect(wrapper.text()).toContain("Todavía no tienes ningún entrenador vinculado");
  });

  it("shows the backend error when saving the profile fails", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USER });
    fetchMeMock.mockResolvedValue(USER);
    updateProfileMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "El nombre debe tener al menos 2 caracteres" } },
    });

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("El nombre debe tener al menos 2 caracteres");
  });
});
