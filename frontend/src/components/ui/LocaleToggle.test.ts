import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { i18n } from "../../i18n";
import { useLocaleStore } from "../../stores/locale";
import LocaleToggle from "./LocaleToggle.vue";

describe("LocaleToggle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("tells the user when the language couldn't be switched", async () => {
    const wrapper = mount(LocaleToggle, { global: { plugins: [i18n] } });
    expect(wrapper.find("[role='alert']").exists()).toBe(false);

    useLocaleStore().$patch({ switchFailed: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.get("[role='alert']").text()).toBe("No se pudo cambiar el idioma. Revisa tu conexión.");
  });
});
