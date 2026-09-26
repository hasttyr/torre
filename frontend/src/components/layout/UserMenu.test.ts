import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import { useThemeStore } from "../../stores/theme";
import UserMenu from "./UserMenu.vue";

vi.mock("../../services/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/auth")>()),
  logoutUser: vi.fn(),
}));

enableAutoUnmount(afterEach);

async function mountMenu() {
  useAuthStore().$patch({
    token: "token",
    user: { id: "u-1", name: "Ana Torres", email: "ana@example.com", role: "PLAYER" } as never,
  });
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  await router.push("/panel");
  // attachTo: the menu opens in a portal on <body>, and focus only moves between attached nodes.
  const wrapper = mount(UserMenu, { global: { plugins: [router, i18n] }, attachTo: document.body });
  return { router, trigger: wrapper.get("button") };
}

/** The open menu, rendered by reka-ui in a portal outside the wrapper. */
const menu = () => document.querySelector<HTMLElement>("[role='menu']");
const item = (text: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("[role='menuitem']")).find((node) =>
    node.textContent?.includes(text),
  );

describe("UserMenu", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("is a real menu button: announces a menu and opens one with its items", async () => {
    const { trigger } = await mountMenu();
    expect(trigger.attributes("aria-haspopup")).toBe("menu");
    expect(trigger.attributes("aria-expanded")).toBe("false");

    await trigger.trigger("click");
    await flushPromises();

    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(menu()?.textContent).toContain("ana@example.com");
    expect(item("Mi perfil")).toBeDefined();
    expect(item("Cerrar sesión")).toBeDefined();
  });

  it("opens from the keyboard too", async () => {
    const { trigger } = await mountMenu();

    await trigger.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(menu()).not.toBeNull();
  });

  it("links to the profile, so it can be opened in a new tab", async () => {
    const { trigger } = await mountMenu();
    await trigger.trigger("click");
    await flushPromises();

    const profile = item("Mi perfil")!;

    expect(profile.tagName).toBe("A");
    expect(profile.getAttribute("href")).toBe("/cuenta");
  });

  it("toggles the theme without closing, so the change is visible", async () => {
    const { trigger } = await mountMenu();
    const theme = useThemeStore();
    const before = theme.theme;
    await trigger.trigger("click");
    await flushPromises();

    item("Tema")!.click();
    await flushPromises();

    expect(theme.theme).not.toBe(before);
    expect(menu()).not.toBeNull();
  });

  it("logs out and goes home", async () => {
    const { trigger, router } = await mountMenu();
    await trigger.trigger("click");
    await flushPromises();

    item("Cerrar sesión")!.click();
    // Logging out loads the auth endpoints on demand: wait for it to land.
    await vi.waitFor(() => expect(useAuthStore().isAuthenticated).toBe(false));
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/");
    expect(menu()).toBeNull();
  });

  it("closes on Escape", async () => {
    const { trigger } = await mountMenu();
    await trigger.trigger("click");
    await flushPromises();

    menu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();

    expect(menu()).toBeNull();
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });
});
