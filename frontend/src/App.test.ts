import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

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
