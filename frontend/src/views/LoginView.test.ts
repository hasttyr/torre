import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import LoginView from "./LoginView.vue";

vi.mock("../services/auth", () => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  fetchMe: vi.fn(),
}));

import { loginUser } from "../services/auth";

const loginUserMock = vi.mocked(loginUser);

async function mountLoginView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/cuenta", component: { template: "<div />" } },
    ],
  });
  router.push("/login-under-test");
  await router.isReady();

  const wrapper = mount(LoginView, { global: { plugins: [router, i18n] } });
  return { wrapper, router };
}

describe("LoginView", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows validation errors and does not call the backend with empty fields", async () => {
    const { wrapper } = await mountLoginView();

    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("El correo es requerido");
    expect(wrapper.text()).toContain("La contraseña es requerida");
    expect(loginUserMock).not.toHaveBeenCalled();
  });

  it("logs in and navigates to /cuenta with valid credentials", async () => {
    loginUserMock.mockResolvedValue({
      token: "token-123",
      user: {
        id: "usuario-1",
        name: "Ana Torres",
        email: "ana@example.com",
        status: "ACTIVO",
        role: "ORGANIZADOR",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    const { wrapper, router } = await mountLoginView();

    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loginUserMock).toHaveBeenCalledWith({ email: "ana@example.com", password: "password123" });
    expect(router.currentRoute.value.path).toBe("/cuenta");
  });

  it("shows the backend error message with invalid credentials", async () => {
    loginUserMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Credenciales inválidas" } },
    });

    const { wrapper, router } = await mountLoginView();

    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("incorrecta");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Credenciales inválidas");
    expect(router.currentRoute.value.path).not.toBe("/cuenta");
  });

  it("shows a generic message on a network error", async () => {
    loginUserMock.mockRejectedValue(new Error("Network Error"));

    const { wrapper } = await mountLoginView();

    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("No se pudo conectar con el servidor");
  });
});
