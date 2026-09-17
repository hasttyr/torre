import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AccountView from "./AccountView.vue";

vi.mock("../services/auth", () => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  fetchMe: vi.fn(),
}));

import { fetchMe } from "../services/auth";

const fetchMeMock = vi.mocked(fetchMe);

const USUARIO = {
  id: "usuario-1",
  nombre: "Ana Torres",
  email: "ana@example.com",
  estado: "ACTIVO",
  rol: "ORGANIZADOR",
  createdAt: "2026-01-01T00:00:00.000Z",
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

  return mount(AccountView, { global: { plugins: [router] } });
}

describe("AccountView", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("muestra los datos del usuario guardados en el store mientras refresca el perfil", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", usuario: USUARIO });
    fetchMeMock.mockResolvedValue(USUARIO);

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain("Ana Torres");
    expect(wrapper.text()).toContain("ana@example.com");
    expect(wrapper.text()).toContain("Organizador");
  });

  it("muestra un aviso si falla la actualización del perfil, sin perder los datos ya cargados", async () => {
    const auth = useAuthStore();
    auth.$patch({ token: "token", usuario: USUARIO });
    fetchMeMock.mockRejectedValue(new Error("Network Error"));

    const wrapper = await mountAccountView();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudo actualizar tu perfil");
    expect(wrapper.text()).toContain("Ana Torres");
  });
});
