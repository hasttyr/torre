import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";

import FadeSlide from "./FadeSlide.vue";

describe("FadeSlide", () => {
  it("shows its content while it's there, and nothing once it's gone", async () => {
    const shown = ref(true);
    const wrapper = mount(
      defineComponent(
        () => () => h(FadeSlide, null, () => (shown.value ? h("p", { role: "status" }, "Guardado") : null)),
      ),
    );
    expect(wrapper.get("[role='status']").text()).toBe("Guardado");

    shown.value = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[role='status']").exists()).toBe(false);
  });
});
