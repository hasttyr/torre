import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";

import { i18n } from "../../i18n";
import SkipLink from "./SkipLink.vue";

enableAutoUnmount(afterEach);

// The skip link as App.vue renders it: first, before a page with a header and a <main>.
const Page = defineComponent(() => () => [
  h(SkipLink),
  h("header", [h("a", { href: "/panel" }, "Panel")]),
  h("main", [h("h1", "Contenido")]),
]);

describe("SkipLink", () => {
  it("is the page's first link and takes keyboard users past the header to <main>", async () => {
    const wrapper = mount(Page, { global: { plugins: [i18n] }, attachTo: document.body });
    const link = wrapper.findAll("a")[0];
    expect(link.text()).toBe("Saltar al contenido");

    await link.trigger("click");

    expect(document.activeElement).toBe(wrapper.get("main").element);
  });
});
