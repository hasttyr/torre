import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createRouter, createWebHistory } from "vue-router";

import { useQueryParam } from "./useQueryParam";

enableAutoUnmount(afterEach);

async function mountAt(url: string) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/sala", component: { template: "<div />" } }],
  });
  await router.push(url);
  let params!: { round: ReturnType<typeof useQueryParam>; page: ReturnType<typeof useQueryParam> };
  mount(
    defineComponent({
      setup() {
        params = { round: useQueryParam("ronda"), page: useQueryParam("pagina", "1") };
        return () => h("div");
      },
    }),
    { global: { plugins: [router] } },
  );
  return { router, ...params };
}

describe("useQueryParam", () => {
  it("reads the value a shared link or a reload brings, or the default", async () => {
    const { round, page } = await mountAt("/sala?ronda=3");

    expect(round.value).toBe("3");
    expect(page.value).toBe("1");
  });

  it("writes to the URL without adding history entries, keeping other params", async () => {
    const { router, round } = await mountAt("/sala?vista=tabla");
    const historyLength = window.history.length;

    round.value = "2";
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/sala?vista=tabla&ronda=2");
    expect(window.history.length).toBe(historyLength);
  });

  it("drops the param when set back to its default, for a clean URL", async () => {
    const { router, page } = await mountAt("/sala?pagina=4");

    page.value = "1";
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe("/sala");
  });

  it("keeps every param changed in the same tick", async () => {
    const { router, round, page } = await mountAt("/sala");

    round.value = "2";
    page.value = "3";
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({ ronda: "2", pagina: "3" });
  });
});
