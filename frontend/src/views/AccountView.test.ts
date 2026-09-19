import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import { useAuthStore } from "../stores/auth";
import AccountView from "./AccountView.vue";

vi.mock("../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth")>();
  return {
    ...actual,
    loginUser: vi.fn(),
    logoutUser: vi.fn(),
    fetchMe: vi.fn(),
    updateProfile: vi.fn(),
  };
});

import { fetchMe, updateProfile } from "../services/auth";

const fetchMeMock = vi.mocked(fetchMe);
const updateProfileMock = vi.mocked(updateProfile);

const USUARIO = {
  id: "usuario-1",
  nombre: "Ana Torres",
  email: "ana@example.com",
  estado: "ACTIVO",
  rol: "ORGANIZADOR",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const JUGADOR = {
  id: "usuario-2",
  nombre: "Luis Gómez",
  email: "luis@example.com",
  estado: "ACTIVO",
  rol: "JUGADOR",
  createdAt: "2026-01-01T00:00:00.000Z",
  jugador: {
    codigoUniversitario: "U1",
    programa: "Sistemas",
    semestre: 5,
    fechaNacimiento: null,
    edad: null,
    genero: null,
    discapacidad: null,
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

  return mount(AccountView, { global: { plugins: [router, i18n] } });
}

describe("AccountView", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows the user data saved in the store while refreshing the profile", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USUARIO });
    fetchMeMock.mockResolvedValue(USUARIO);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.get("#nombre").element as HTMLInputElement).value).toBe("Ana Torres");
    expect(wrapper.text()).toContain("ana@example.com");
    expect(wrapper.text()).toContain("Organizador");
  });

  it("shows a notice when refreshing the profile fails, without losing the already loaded data", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USUARIO });
    fetchMeMock.mockRejectedValue(new Error("Network Error"));

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudo actualizar tu perfil");
    expect((wrapper.get("#nombre").element as HTMLInputElement).value).toBe("Ana Torres");
  });

  it("does not show player fields for a user without that profile", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USUARIO });
    fetchMeMock.mockResolvedValue(USUARIO);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.find("#codigo").exists()).toBe(false);
  });

  it("preloads player fields when the user has that profile", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: JUGADOR });
    fetchMeMock.mockResolvedValue(JUGADOR);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.get("#codigo").element as HTMLInputElement).value).toBe("U1");
    expect((wrapper.get("#programa").element as HTMLInputElement).value).toBe("Sistemas");
    expect((wrapper.get("#semestre").element as HTMLInputElement).value).toBe("5");
  });

  it("preloads birth date/gender/disability and shows the calculated age", async () => {
    const auth = useAuthStore();
    const jugadorConDatos = {
      ...JUGADOR,
      jugador: {
        ...JUGADOR.jugador,
        fechaNacimiento: "2005-06-15T00:00:00.000Z",
        edad: 21,
        genero: "FEMENINO" as const,
        discapacidad: "VISUAL" as const,
      },
    };
    auth.$patch({ token: "token", user: jugadorConDatos });
    fetchMeMock.mockResolvedValue(jugadorConDatos);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((wrapper.get("#fechaNacimiento").element as HTMLInputElement).value).toBe("15/06/2005");
    expect((wrapper.get("#genero").element as HTMLSelectElement).value).toBe("FEMENINO");
    expect((wrapper.get("#discapacidad").element as HTMLSelectElement).value).toBe("VISUAL");
    expect(wrapper.text()).toContain("Edad actual: 21 años");
  });

  it("only offers gender and disability from the closed catalog (no free-text input)", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: JUGADOR });
    fetchMeMock.mockResolvedValue(JUGADOR);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.get("#genero").element.tagName).toBe("SELECT");
    expect(wrapper.get("#discapacidad").element.tagName).toBe("SELECT");
    expect(wrapper.findAll("#genero option").length).toBeGreaterThan(1);
  });

  it("sends fechaNacimiento/genero/discapacidad when saving (HU20)", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: JUGADOR });
    fetchMeMock.mockResolvedValue(JUGADOR);
    updateProfileMock.mockResolvedValue(JUGADOR);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("#fechaNacimiento").setValue("15/06/2005");
    await wrapper.get("#fechaNacimiento").trigger("blur");
    await wrapper.get("#genero").setValue("FEMENINO");
    await wrapper.get("#discapacidad").setValue("VISUAL");
    await wrapper.get("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaNacimiento: "2005-06-15",
        genero: "FEMENINO",
        discapacidad: "VISUAL",
      }),
    );
  });

  it("saves profile changes and shows a success message (HU20)", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USUARIO });
    fetchMeMock.mockResolvedValue(USUARIO);
    updateProfileMock.mockResolvedValue({ ...USUARIO, nombre: "Ana T." });

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await wrapper.get("#nombre").setValue("Ana T.");
    await wrapper.get("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(updateProfileMock).toHaveBeenCalledWith({ nombre: "Ana T." });
    expect(wrapper.text()).toContain("Perfil actualizado");
  });

  it("shows the backend error when saving the profile fails", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", user: USUARIO });
    fetchMeMock.mockResolvedValue(USUARIO);
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
