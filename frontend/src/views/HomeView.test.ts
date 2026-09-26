import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import HomeView from "./HomeView.vue";

async function mountHome() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:p(.*)*", component: { template: "<div />" } }],
  });
  await router.push("/");
  return mount(HomeView, { global: { plugins: [router, i18n] } });
}

describe("HomeView", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("doesn't dress its feature cards up as clickable: no hover lift on something that isn't a link", async () => {
    const cards = (await mountHome()).findAll("article");

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.find("a").exists()).toBe(false);
      expect(card.classes().filter((name) => name.startsWith("hover:") || name === "transition-all")).toEqual([]);
    }
  });
});
