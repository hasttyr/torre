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
      { path: "/torneos", component: { template: "<div />" } },
      { path: "/mis-torneos", component: { template: "<div />" } },
      { path: "/mis-jugadores", component: { template: "<div />" } },
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

  it("logs in and navigates to the organizer dashboard with valid credentials", async () => {
    loginUserMock.mockResolvedValue({
      token: "token-123",
      user: {
        id: "usuario-1",
        name: "Ana Torres",
        email: "ana@example.com",
        status: "ACTIVE",
        role: "ORGANIZER",
        createdAt: "2026-01-01T00:00:00.000Z",
        dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
      },
    });

    const { wrapper, router } = await mountLoginView();

    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loginUserMock).toHaveBeenCalledWith({ email: "ana@example.com", password: "password123" });
    expect(router.currentRoute.value.path).toBe("/torneos");
  });

  it("logs in and navigates to the player dashboard for a PLAYER role", async () => {
    loginUserMock.mockResolvedValue({
      token: "token-123",
      user: {
        id: "usuario-2",
        name: "Luis Gómez",
        email: "luis@example.com",
        status: "ACTIVE",
        role: "PLAYER",
        createdAt: "2026-01-01T00:00:00.000Z",
        dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
      },
    });

    const { wrapper, router } = await mountLoginView();

    await wrapper.find('input[type="email"]').setValue("luis@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.path).toBe("/mis-torneos");
  });

  it("honors a redirect query param over the role's default dashboard", async () => {
    loginUserMock.mockResolvedValue({
      token: "token-123",
      user: {
        id: "usuario-1",
        name: "Ana Torres",
        email: "ana@example.com",
        status: "ACTIVE",
        role: "ORGANIZER",
        createdAt: "2026-01-01T00:00:00.000Z",
        dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
      },
    });

    const { wrapper, router } = await mountLoginView();
    await router.push({ path: "/login-under-test", query: { redirect: "/cuenta" } });

    await wrapper.find('input[type="email"]').setValue("ana@example.com");
    await wrapper.find('input[type="password"]').setValue("password123");
    await wrapper.find("form").trigger("submit.prevent");
    await new Promise((resolve) => setTimeout(resolve, 0));

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
