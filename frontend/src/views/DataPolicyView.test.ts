import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { DATA_POLICY_VERSION } from "@contracts";
import { i18n } from "../i18n";
import DataPolicyView from "./DataPolicyView.vue";

async function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:any(.*)", component: { template: "<div />" } }],
  });
  await router.push("/politica-de-datos");
  return mount(DataPolicyView, { global: { plugins: [router, i18n] } });
}

// RN-10 / Ley 1581: the authorization asked at sign-up points to a text (#129).
describe("DataPolicyView", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("says up front that it's an academic draft, not the university's official policy", async () => {
    const notice = (await mountView()).get("[data-test='draft-notice']");

    expect(notice.text()).toContain("Borrador con fines académicos");
    expect(notice.text()).toContain("No es la política oficial");
  });

  it("shows the version a new account accepts, the same the API records", async () => {
    expect((await mountView()).text()).toContain(`Versión ${DATA_POLICY_VERSION}`);
  });

  it("covers what Ley 1581 asks to inform: purposes, sensitive data, rights and how to exercise them", async () => {
    const headings = (await mountView()).findAll("h2").map((heading) => heading.text());

    expect(headings).toHaveLength(10);
    expect(headings).toEqual(
      expect.arrayContaining([
        "3. Para qué se usan",
        "4. Datos sensibles",
        "7. Tus derechos (Ley 1581 de 2012, art. 8)",
        "8. Cómo ejercerlos",
      ]),
    );
  });
});
