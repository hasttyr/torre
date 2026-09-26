import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import LoginView from "./LoginView.vue";

vi.mock("../../services/auth", () => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  fetchMe: vi.fn(),
}));

// Idle tasks run right away so their effect can be asserted.
vi.mock("../../lib/idle", () => ({ whenIdle: (task: () => void) => task() }));

import { loginUser } from "../../services/auth";

const loginUserMock = vi.mocked(loginUser);

async function mountLoginView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/cuenta", component: { template: "<div />" } },
      { path: "/panel", component: { template: "<div />" } },
    ],
  });
  router.push("/login-under-test");
  await router.isReady();

  // attachTo: a failed submit moves focus, which jsdom only tracks for attached nodes.
  const wrapper = mount(LoginView, { global: { plugins: [router, i18n] }, attachTo: document.body });
  return { wrapper, router };
}

enableAutoUnmount(afterEach);

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

  it("ties each error to its field and takes the user to the first one", async () => {
    const { wrapper } = await mountLoginView();

    await wrapper.find("form").trigger("submit.prevent");
    await flushPromises();

    const email = wrapper.get("#email");
    expect(email.attributes("aria-invalid")).toBe("true");
    expect(wrapper.get(`#${email.attributes("aria-describedby")}`).text()).toBe("El correo es requerido");
    expect(wrapper.get("#password").attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(email.element);
  });

  it("names its fields for the browser's autofill, without spellchecking the email", async () => {
    const { wrapper } = await mountLoginView();

    expect(wrapper.get("#email").attributes()).toMatchObject({
      name: "email",
      autocomplete: "email",
      spellcheck: "false",
    });
    expect(wrapper.get("#password").attributes()).toMatchObject({ name: "password", autocomplete: "current-password" });
  });

  it("logs in and navigates to their dashboard with valid credentials", async () => {
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
    expect(router.currentRoute.value.path).toBe("/panel");
  });

  it("logs in and lands a PLAYER on the same dashboard route (widgets are role-driven)", async () => {
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

    expect(router.currentRoute.value.path).toBe("/panel");
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

describe("LoginView after the server ended a session", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("explains why the user is back at the login page", async () => {
    const { wrapper, router } = await mountLoginView();

    expect(wrapper.text()).not.toContain("Tu sesión terminó");
    await router.push({ path: "/login-under-test", query: { expired: "1", redirect: "/panel" } });

    expect(wrapper.text()).toContain("Tu sesión terminó");
  });
});

describe("LoginView while the user types", () => {
  it("downloads the dashboard's code in the background, so it opens at once after signing in", async () => {
    setActivePinia(createPinia());
    const loadPanel = vi.fn(() => Promise.resolve({ default: { template: "<div />" } }));
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: "/panel", component: loadPanel },
        { path: "/:p(.*)*", component: { template: "<div />" } },
      ],
    });
    await router.push("/login");

    mount(LoginView, { global: { plugins: [router, i18n] } });

    expect(loadPanel).toHaveBeenCalledOnce();
  });
});
