import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import StatTile from "./StatTile.vue";

describe("StatTile", () => {
  it("is a valid <dl> group: only dt and dd, the hint as a second description of the term", () => {
    const wrapper = mount(StatTile, { props: { label: "Rendimiento", value: "57 %", hint: "Puntos por partida" } });

    // Inside a <dl>, a wrapping <div> may only hold dt and dd elements.
    expect(wrapper.element.tagName).toBe("DIV");
    expect(Array.from(wrapper.element.children as HTMLCollection).map((child) => child.tagName)).toEqual(["DT", "DD", "DD"]);
    expect(wrapper.findAll("dd").map((dd) => dd.text())).toEqual(["57 %", "Puntos por partida"]);
  });

  it("leaves the hint out when there is none", () => {
    const wrapper = mount(StatTile, { props: { label: "Partidas", value: "27" } });

    expect(wrapper.findAll("dd")).toHaveLength(1);
  });
});
