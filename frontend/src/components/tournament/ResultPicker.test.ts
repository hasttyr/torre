import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import ResultPicker from "./ResultPicker.vue";

const mountPicker = (current: string | null = null) =>
  mount(ResultPicker, { props: { current }, global: { plugins: [i18n] } });

describe("ResultPicker", () => {
  it("offers the results of a game played, and the forfeits apart (decision 011)", () => {
    const groups = mountPicker().findAll("[role='group']");

    expect(groups.map((group) => group.attributes("aria-label"))).toEqual(["Resultado", "Incomparecencia"]);
    expect(groups[0]!.findAll("button").map((button) => button.text())).toEqual(["1 – 0", "½ – ½", "0 – 1"]);
    expect(groups[1]!.findAll("button").map((button) => button.text())).toEqual(["1F – 0F", "0F – 1F", "0F – 0F"]);
  });

  it("names each forfeit for a screen reader, saying who didn't show up", () => {
    const names = mountPicker()
      .findAll("[role='group']")[1]!
      .findAll("button")
      .map((button) => button.attributes("aria-label"));

    expect(names).toEqual([
      "1F – 0F, No se presentaron las negras",
      "0F – 1F, No se presentaron las blancas",
      "0F – 0F, No se presentó ninguno",
    ]);
  });

  it("starts each button's name with the score it shows, so voice control finds it (WCAG 2.5.3)", () => {
    for (const button of mountPicker().findAll("button")) {
      expect(button.attributes("aria-label")).toMatch(new RegExp(`^${button.text()}, `));
    }
  });

  it("emits the value picked, and marks the current one", async () => {
    const wrapper = mountPicker("0F-1F");
    const forfeits = wrapper.findAll("[role='group']")[1]!.findAll("button");

    expect(forfeits[1]!.attributes("aria-pressed")).toBe("true");
    await forfeits[0]!.trigger("click");
    expect(wrapper.emitted("pick")).toEqual([["1F-0F"]]);
  });
});
