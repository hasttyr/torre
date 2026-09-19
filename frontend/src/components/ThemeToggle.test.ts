import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "../i18n";
import ThemeToggle from "./ThemeToggle.vue";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    setActivePinia(createPinia());
  });

  it("arranca en modo oscuro y cambia a claro al hacer click", async () => {
    const wrapper = mount(ThemeToggle, { global: { plugins: [i18n] } });

    expect(wrapper.attributes("title")).toBe("Modo claro");

    await wrapper.trigger("click");

    expect(wrapper.attributes("title")).toBe("Modo oscuro");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persiste la selección en localStorage", async () => {
    const wrapper = mount(ThemeToggle, { global: { plugins: [i18n] } });

    await wrapper.trigger("click");

    expect(localStorage.getItem("torre.theme")).toBe("light");
  });
});
