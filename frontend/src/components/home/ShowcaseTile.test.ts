import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";

import { stubIntersectionObserver } from "../../test-support/intersectionObserver";
import ShowcaseTile from "./ShowcaseTile.vue";

enableAutoUnmount(afterEach);

const mountTile = () =>
  mount(ShowcaseTile, {
    props: { title: "Emparejamiento suizo", text: "Sin repetir enfrentamientos." },
    slots: { default: () => h("table", "Ronda 3") },
  });

describe("ShowcaseTile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names its feature in a heading, with the text that explains it", () => {
    const wrapper = mountTile();

    expect(wrapper.get("h3").text()).toBe("Emparejamiento suizo");
    expect(wrapper.get("p").text()).toBe("Sin repetir enfrentamientos.");
  });

  it("keeps its illustration out of the accessibility tree: it's sample data, not content", () => {
    const render = mountTile().get("[data-render]");

    expect(render.attributes("aria-hidden")).toBe("true");
    expect(render.find("table").exists()).toBe(true);
  });

  it("brings its illustration in once the tile scrolls into view", async () => {
    const { reveal } = stubIntersectionObserver();
    const wrapper = mountTile();
    expect(wrapper.get("[data-render]").attributes("data-revealed")).toBe("false");

    reveal();
    await nextTick();

    expect(wrapper.get("[data-render]").attributes("data-revealed")).toBe("true");
  });
});
