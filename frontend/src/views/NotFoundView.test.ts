import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { i18n } from "../i18n";
import NotFoundView from "./NotFoundView.vue";

describe("NotFoundView", () => {
  it("says the page doesn't exist and offers the way back home", async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/:rest(.*)*", component: NotFoundView }],
    });
    await router.push("/esto-no-existe");

    const wrapper = mount(NotFoundView, { global: { plugins: [router, i18n] } });

    expect(wrapper.get("h1").text()).toBe("Página no encontrada");
    expect(wrapper.get("a").attributes("href")).toBe("/");
  });
});
