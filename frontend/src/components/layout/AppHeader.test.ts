import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { router as appRouter } from "../../router";
import { useAuthStore } from "../../stores/auth";
import AppHeader from "./AppHeader.vue";

// The app's own routes (they declare the nav's sections, meta.nav), with stand-in pages.
const appRoutes = () =>
  createRouter({
    history: createWebHistory(),
    routes: appRouter.getRoutes().map(({ path, meta }) => ({ path, meta, component: { template: "<div />" } })),
  });

async function mountHeader(role: string | null) {
  if (role) {
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana Torres", role } as never });
  }
  const router = appRoutes();
  await router.push("/");
  return mount(AppHeader, { global: { plugins: [router, i18n] } });
}

/** The desktop nav's link targets, in order. */
const desktopLinks = (wrapper: Awaited<ReturnType<typeof mountHeader>>) =>
  wrapper
    .findAll("nav")[0]
    .findAll("a")
    .map((link) => link.attributes("href"));

describe("AppHeader navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it.each([
    ["PLAYER", ["/panel", "/mis-torneos", "/en-juego"]],
    ["COACH", ["/panel", "/mis-jugadores", "/en-juego"]],
    ["ARBITER", ["/panel", "/en-juego"]],
    ["ORGANIZER", ["/panel", "/torneos", "/clubes"]],
    ["ADMINISTRATOR", ["/panel", "/torneos", "/clubes", "/usuarios", "/auditoria"]],
  ])("shows %s only the sections its role can open", async (role, expected) => {
    expect(desktopLinks(await mountHeader(role))).toEqual(expected);
  });

  // HU25 / RF17: the tournaments open for registration, readable without signing in.
  it("offers visitors the open tournaments, login and sign-up", async () => {
    expect(desktopLinks(await mountHeader(null))).toEqual(["/torneos-abiertos", "/login", "/registro"]);
  });

  it.each(["mouseenter", "focus"])("starts downloading a section's page on %s of its link", async (event) => {
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana Torres", role: "ORGANIZER" } as never });
    const loadClubs = vi.fn(() => Promise.resolve({ default: { template: "<div />" } }));
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: "/clubes", component: loadClubs, meta: { nav: { labelKey: "header.clubs", order: 1 } } },
        { path: "/:p(.*)*", component: { template: "<div />" } },
      ],
    });
    await router.push("/");
    const wrapper = mount(AppHeader, { global: { plugins: [router, i18n] } });

    await wrapper.findAll("nav")[0].get("a[href='/clubes']").trigger(event);

    expect(loadClubs).toHaveBeenCalledOnce();
  });

  it("gives only signed-in users the avatar menu, shown at once (its code loads later)", async () => {
    const visitor = await mountHeader(null);
    expect(visitor.find("button[aria-haspopup='menu']").exists()).toBe(false);

    const user = await mountHeader("PLAYER");
    expect(user.findAll("button[aria-haspopup='menu']").map((avatar) => avatar.text())).toEqual(["AT", "AT"]);
  });

  it("opens a visitor's mobile menu with its links, and closes it on navigation", async () => {
    const wrapper = await mountHeader(null);
    const toggle = () => wrapper.get("button[aria-label='Abrir menú'], button[aria-label='Cerrar menú']");
    expect(wrapper.findAll("nav")).toHaveLength(1);

    await toggle().trigger("click");
    expect(toggle().attributes("aria-expanded")).toBe("true");
    expect(wrapper.findAll("nav")).toHaveLength(2);
    const mobileNav = wrapper.findAll("nav").at(-1)!;
    expect(mobileNav.findAll("a").map((link) => link.attributes("href"))).toEqual([
      "/torneos-abiertos",
      "/login",
      "/registro",
    ]);

    await mobileNav.findAll("a")[0].trigger("click");
    expect(toggle().attributes("aria-expanded")).toBe("false");
  });

  it("gives signed-in users no menu button on phones: their sections are in the tab bar", async () => {
    const wrapper = await mountHeader("COACH");

    expect(wrapper.find("button[aria-label='Abrir menú']").exists()).toBe(false);
  });

  it("closes the mobile menu on Escape, handing focus back to its button", async () => {
    const router = appRoutes();
    await router.push("/");
    // attachTo: focus only moves between attached nodes in jsdom.
    const wrapper = mount(AppHeader, { global: { plugins: [router, i18n] }, attachTo: document.body });
    await wrapper.get("button[aria-label='Abrir menú']").trigger("click");
    const link = wrapper.findAll("nav").at(-1)!.findAll("a")[1];
    (link.element as HTMLElement).focus();

    await link.trigger("keydown", { key: "Escape" });

    expect(wrapper.findAll("nav")).toHaveLength(1);
    expect(document.activeElement).toBe(wrapper.get("button[aria-label='Abrir menú']").element);
    wrapper.unmount();
  });
});
