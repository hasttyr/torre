import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../../i18n";
import { router as appRouter } from "../../router";
import { useAuthStore } from "../../stores/auth";
import MobileTabBar from "./MobileTabBar.vue";

// The app's own routes (they declare the sections, meta.nav), with stand-in pages.
async function mountTabBar(role: string | null, path = "/") {
  if (role) {
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana Torres", role } as never });
  }
  const router = createRouter({
    history: createWebHistory(),
    routes: appRouter.getRoutes().map(({ path, meta }) => ({ path, meta, component: { template: "<div />" } })),
  });
  await router.push(path);
  return mount(MobileTabBar, { global: { plugins: [router, i18n] } });
}

describe("MobileTabBar", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("is not there for visitors", async () => {
    expect((await mountTabBar(null)).find("nav").exists()).toBe(false);
  });

  it.each([
    ["PLAYER", ["/panel", "/mis-torneos", "/en-juego"], ["Panel", "Torneos", "En juego"]],
    [
      "ADMINISTRATOR",
      ["/panel", "/torneos", "/clubes", "/usuarios", "/auditoria"],
      ["Panel", "Mis torneos", "Clubes", "Usuarios", "Auditoría"],
    ],
  ])("gives %s the header's sections, each named under its glyph", async (role, hrefs, names) => {
    const nav = (await mountTabBar(role)).get("nav[aria-label='Secciones']");

    expect(nav.findAll("a").map((link) => link.attributes("href"))).toEqual(hrefs);
    expect(nav.findAll("a").map((link) => link.text())).toEqual(names);
    expect(nav.findAll("a svg[aria-hidden='true']")).toHaveLength(hrefs.length);
  });

  it("marks the section being viewed", async () => {
    const wrapper = await mountTabBar("PLAYER", "/en-juego");

    expect(wrapper.get("a.router-link-active").attributes("href")).toBe("/en-juego");
  });
});
