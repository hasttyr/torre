import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, onMounted } from "vue";
import { createRouter, createWebHistory, useRoute } from "vue-router";

import App from "./App.vue";
import { i18n } from "./i18n";
import { useConfirm } from "./lib/confirm";

enableAutoUnmount(afterEach);

async function mountApp() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:any(.*)*", component: { template: "<main>Página</main>" } }],
  });
  await router.push("/");
  return mount(App, { global: { plugins: [router, i18n] }, attachTo: document.body });
}

describe("App shell", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the page without the confirm dialog's code, until a confirmation is asked", async () => {
    await mountApp();
    expect(document.querySelector("[role='alertdialog']")).toBeNull();

    const answer = useConfirm()({ title: "¿Retirar?", message: "Luis deja el torneo.", confirmLabel: "Retirar" });
    await vi.dynamicImportSettled();
    await flushPromises();

    expect(document.querySelector("[role='alertdialog']")?.textContent).toContain("Luis deja el torneo.");
    Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent === "Retirar")!
      .click();
    await expect(answer).resolves.toBe(true);
  });
});

describe("App shell routing", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("gives each tournament its own page, even when only the id in the URL changes", async () => {
    // Like the room: reads its tournament once, when it's set up.
    const loaded: string[] = [];
    const Room = defineComponent(() => {
      const route = useRoute();
      onMounted(() => loaded.push(String(route.params.id)));
      return () => h("main", `Sala ${String(route.params.id)}`);
    });
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/torneos/:id/sala", component: Room }],
    });
    await router.push("/torneos/A/sala");
    mount(App, { global: { plugins: [router, i18n] } });
    await flushPromises();

    await router.push("/torneos/B/sala");
    await flushPromises();

    expect(loaded).toEqual(["A", "B"]);
  });

  it("keeps the page when only the query changes (a tab, a filter)", async () => {
    const mounts: string[] = [];
    const Room = defineComponent(() => {
      onMounted(() => mounts.push("mounted"));
      return () => h("main", "Sala");
    });
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/torneos/:id/sala", component: Room }],
    });
    await router.push("/torneos/A/sala");
    mount(App, { global: { plugins: [router, i18n] } });
    await flushPromises();

    await router.push("/torneos/A/sala?ronda=2");
    await flushPromises();

    expect(mounts).toHaveLength(1);
  });
});
