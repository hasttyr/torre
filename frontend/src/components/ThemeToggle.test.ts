import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    const wrapper = mount(ThemeToggle);

    expect(wrapper.attributes("title")).toBe("Modo claro");

    await wrapper.trigger("click");

    expect(wrapper.attributes("title")).toBe("Modo oscuro");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persiste la selección en localStorage", async () => {
    const wrapper = mount(ThemeToggle);

    await wrapper.trigger("click");

    expect(localStorage.getItem("torre.theme")).toBe("light");
  });
});
