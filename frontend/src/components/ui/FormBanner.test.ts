import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import FormBanner from "./FormBanner.vue";

describe("FormBanner", () => {
  it("announces an error right away, marked with an icon", () => {
    const wrapper = mount(FormBanner, { props: { kind: "error" }, slots: { default: "No se pudo guardar" } });

    expect(wrapper.attributes("role")).toBe("alert");
    expect(wrapper.text()).toBe("No se pudo guardar");
    expect(wrapper.find("svg[aria-hidden='true']").exists()).toBe(true);
  });

  it("announces a success politely, without interrupting", () => {
    const wrapper = mount(FormBanner, { props: { kind: "success" }, slots: { default: "Guardado" } });

    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.classes()).toContain("banner--success");
  });
});
