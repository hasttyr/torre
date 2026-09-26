import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { useAuthStore } from "../../stores/auth";
import LazyUserMenu from "./LazyUserMenu.vue";

// Idle tasks wait until the test runs them.
const idleTasks: (() => void)[] = [];
vi.mock("../../lib/idle", () => ({ whenIdle: (task: () => void) => idleTasks.push(task) }));

enableAutoUnmount(afterEach);

async function mountLazyMenu() {
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
  return mount(LazyUserMenu, { global: { plugins: [router, i18n] }, attachTo: document.body });
}

const settle = async () => {
  await flushPromises();
  await vi.dynamicImportSettled();
  await flushPromises();
};
const avatar = () => document.querySelector<HTMLButtonElement>("button[aria-haspopup='menu']")!;
// reka-ui's trigger carries data-state; the stand-in doesn't.
const realMenuLoaded = () => avatar().hasAttribute("data-state");
const openMenu = () => document.querySelector("[role='menu']");

describe("LazyUserMenu", () => {
  beforeEach(() => {
    idleTasks.length = 0;
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("shows the avatar at once, and loads the real menu only once the browser is idle", async () => {
    await mountLazyMenu();
    expect(avatar().textContent?.trim()).toBe("AT");
    expect(avatar().getAttribute("aria-label")).toContain("Ana Torres");
    await settle();
    expect(realMenuLoaded()).toBe(false);

    idleTasks.forEach((task) => task());
    await settle();

    expect(realMenuLoaded()).toBe(true);
    expect(openMenu()).toBeNull();
  });

  it("loads it early when the user points at the avatar", async () => {
    await mountLazyMenu();

    avatar().dispatchEvent(new Event("pointerenter"));
    await settle();

    expect(realMenuLoaded()).toBe(true);
  });

  it("opens the menu as soon as it arrives when the avatar was clicked before", async () => {
    await mountLazyMenu();

    avatar().click();
    await settle();

    expect(realMenuLoaded()).toBe(true);
    expect(openMenu()?.textContent).toContain("ana@example.com");
  });

  it("keeps keyboard focus on the avatar when the real menu takes its place", async () => {
    await mountLazyMenu();

    avatar().focus();
    await settle();

    expect(realMenuLoaded()).toBe(true);
    expect(document.activeElement).toBe(avatar());
    expect(openMenu()).toBeNull();
  });
});
