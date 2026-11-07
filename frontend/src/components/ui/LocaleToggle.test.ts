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

  // WCAG 2.5.3 (label in name): someone using voice control says what they see.
  it("is named starting with the code it shows, then what it does", () => {
    const button = mount(LocaleToggle, { global: { plugins: [i18n] } }).get("button");

    expect(button.text()).toBe("ES");
    expect(button.attributes("aria-label")).toBe("ES, Switch to English");
  });

  it("tells the user when the language couldn't be switched", async () => {
    const wrapper = mount(LocaleToggle, { global: { plugins: [i18n] } });
    expect(wrapper.find("[role='alert']").exists()).toBe(false);

    useLocaleStore().$patch({ switchFailed: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.get("[role='alert']").text()).toBe("No se pudo cambiar el idioma. Revisa tu conexión.");
  });
});
