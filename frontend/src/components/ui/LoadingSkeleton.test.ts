import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LoadingSkeleton from "./LoadingSkeleton.vue";

const VARIANTS = ["list", "rows", "table", "cards", "room", "lines"] as const;

describe("LoadingSkeleton", () => {
  it("tells a screen reader what is loading, and that the region is busy", () => {
    const wrapper = mount(LoadingSkeleton, { props: { label: "Cargando torneos…" } });
    const region = wrapper.get("[role='status']");

    expect(region.attributes("aria-busy")).toBe("true");
    expect(region.get(".sr-only").text()).toBe("Cargando torneos…");
  });

  it.each(VARIANTS)("keeps the %s shapes out of the accessibility tree", (variant) => {
    const wrapper = mount(LoadingSkeleton, { props: { label: "Cargando…", variant } });
    const shapes = wrapper.get("[aria-hidden='true']");

    expect(shapes.findAll(".skeleton").length).toBeGreaterThan(0);
    expect(shapes.text()).toBe("");
  });

  it("draws as many placeholders as items are expected", () => {
    const list = mount(LoadingSkeleton, { props: { label: "Cargando…", variant: "list", count: 5 } });
    const rows = mount(LoadingSkeleton, { props: { label: "Cargando…", variant: "rows", count: 2 } });

    expect(list.findAll("li")).toHaveLength(5);
    expect(rows.findAll("li")).toHaveLength(2);
  });

  it("waits a moment before showing, so a fast answer doesn't make the page blink", () => {
    const wrapper = mount(LoadingSkeleton, { props: { label: "Cargando…" } });

    expect(wrapper.get("[role='status']").classes()).toContain("animate-appear");
  });
});
