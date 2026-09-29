import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import type { Tiebreak } from "../../services/tournaments";
import TiebreakOrderPicker from "./TiebreakOrderPicker.vue";

function mountPicker(modelValue: Tiebreak[], disabled = false) {
  const wrapper = mount(TiebreakOrderPicker, {
    props: {
      modelValue,
      disabled,
      "onUpdate:modelValue": (value: Tiebreak[]) => wrapper.setProps({ modelValue: value }),
    },
    global: { plugins: [i18n] },
  });
  return wrapper;
}

const order = (wrapper: ReturnType<typeof mountPicker>) =>
  wrapper.findAll("ol li").map((item) => item.find("span").text());
const button = (wrapper: ReturnType<typeof mountPicker>, label: string) =>
  wrapper.findAll("button").find((candidate) => candidate.attributes("aria-label") === label)!;

describe("TiebreakOrderPicker (RN-05, HU13)", () => {
  it("lists the chosen criteria in their order, by name", () => {
    const wrapper = mountPicker(["BUCHHOLZ", "DIRECT_ENCOUNTER"]);

    expect(order(wrapper)).toEqual(["Buchholz", "Resultado particular"]);
  });

  it("moves a criterion up or down the order", async () => {
    const wrapper = mountPicker(["BUCHHOLZ", "SONNEBORN_BERGER", "DIRECT_ENCOUNTER"]);

    await button(wrapper, "Subir Sonneborn-Berger").trigger("click");
    expect(wrapper.props("modelValue")).toEqual(["SONNEBORN_BERGER", "BUCHHOLZ", "DIRECT_ENCOUNTER"]);

    await button(wrapper, "Bajar Sonneborn-Berger").trigger("click");
    expect(wrapper.props("modelValue")).toEqual(["BUCHHOLZ", "SONNEBORN_BERGER", "DIRECT_ENCOUNTER"]);
  });

  it("can't move the first one up or the last one down", () => {
    const wrapper = mountPicker(["BUCHHOLZ", "SONNEBORN_BERGER"]);

    expect(button(wrapper, "Subir Buchholz").attributes("disabled")).toBeDefined();
    expect(button(wrapper, "Bajar Sonneborn-Berger").attributes("disabled")).toBeDefined();
  });

  it("removes a criterion, and offers to add back only the ones not chosen", async () => {
    const wrapper = mountPicker(["BUCHHOLZ", "SONNEBORN_BERGER"]);

    await button(wrapper, "Quitar Buchholz").trigger("click");
    expect(wrapper.props("modelValue")).toEqual(["SONNEBORN_BERGER"]);

    const options = wrapper
      .findAll("select option")
      .map((option) => option.attributes("value"))
      .filter(Boolean);
    expect(options).toEqual(["BUCHHOLZ", "BUCHHOLZ_CUT1", "DIRECT_ENCOUNTER", "ARO"]);
  });

  it("adds the picked criterion at the end of the order", async () => {
    const wrapper = mountPicker(["BUCHHOLZ"]);

    await wrapper.get("select").setValue("DIRECT_ENCOUNTER");
    await wrapper
      .findAll("button")
      .find((candidate) => candidate.text() === "Agregar")!
      .trigger("click");

    expect(wrapper.props("modelValue")).toEqual(["BUCHHOLZ", "DIRECT_ENCOUNTER"]);
  });

  it("locks every control once the order can't change anymore", () => {
    const wrapper = mountPicker(["BUCHHOLZ", "SONNEBORN_BERGER"], true);

    expect(wrapper.get("fieldset").attributes("disabled")).toBeDefined();
  });
});
