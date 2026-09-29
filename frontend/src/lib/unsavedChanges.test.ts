import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import { clickConfirmDialogButton, mountConfirmDialogHost } from "../test-support/confirmDialog";
import { hasChanges, useUnsavedChangesGuard } from "./unsavedChanges";

describe("hasChanges", () => {
  it("compares list fields by their items, in order", () => {
    const saved = { tiebreaks: ["BUCHHOLZ", "SONNEBORN_BERGER"] };

    expect(hasChanges({ tiebreaks: ["BUCHHOLZ", "SONNEBORN_BERGER"] }, saved)).toBe(false);
    expect(hasChanges({ tiebreaks: ["SONNEBORN_BERGER", "BUCHHOLZ"] }, saved)).toBe(true);
    expect(hasChanges({ tiebreaks: ["BUCHHOLZ"] }, saved)).toBe(true);
  });

  it("compares every saved field against the form's current value", () => {
    const saved = { name: "Copa", rounds: "5" };

    expect(hasChanges({ name: "Copa", rounds: "5" }, saved)).toBe(false);
    expect(hasChanges({ name: "Copa", rounds: "7" }, saved)).toBe(true);
  });
});

enableAutoUnmount(afterEach);

const dirty = ref(false);

// A page with the guard, the way a form view uses it.
const FormPage = defineComponent({
  setup() {
    useUnsavedChangesGuard(() => dirty.value);
    return () => h("form");
  },
});

async function mountAt() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/form", component: FormPage },
      { path: "/elsewhere", component: { template: "<div />" } },
    ],
  });
  await router.push("/form");
  mount({ template: "<RouterView />" }, { global: { plugins: [router, i18n] } });
  await flushPromises();
  return router;
}

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    dirty.value = false;
  });

  it("lets the user leave freely while nothing changed", async () => {
    const router = await mountAt();

    await router.push("/elsewhere");

    expect(router.currentRoute.value.path).toBe("/elsewhere");
  });

  it.each([
    ["Cancelar", "/form"],
    ["Salir sin guardar", "/elsewhere"],
  ])("asks before leaving with unsaved changes (%s)", async (answer, landing) => {
    mountConfirmDialogHost();
    const router = await mountAt();
    dirty.value = true;

    const navigation = router.push("/elsewhere");
    await flushPromises();
    expect(document.body.textContent).toContain("Tienes cambios sin guardar");
    await clickConfirmDialogButton(answer);
    await navigation;

    expect(router.currentRoute.value.path).toBe(landing);
  });

  it("has the browser warn before a reload or tab close, only with unsaved changes", async () => {
    await mountAt();

    expect(unload()).toBe(false);
    dirty.value = true;
    expect(unload()).toBe(true);
  });

  it("stops the browser's warning once the page is left", async () => {
    const router = await mountAt();
    await router.push("/elsewhere");

    dirty.value = true;

    expect(unload()).toBe(false);
  });
});

/** Fires the browser's reload/close event; whether something asked it to warn. */
function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
