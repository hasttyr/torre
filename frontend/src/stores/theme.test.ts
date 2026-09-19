import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeStore } from "./theme";

function mockMatchMedia(prefersLight: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: light)" ? prefersLight : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 'dark' when there is no saved or system preference", () => {
    mockMatchMedia(false);

    const store = useThemeStore();

    expect(store.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("respects the system preference (light) when nothing is saved", () => {
    mockMatchMedia(true);

    const store = useThemeStore();

    expect(store.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("prioritizes the theme saved in localStorage over the system preference", () => {
    mockMatchMedia(true);
    localStorage.setItem("torre.theme", "dark");

    const store = useThemeStore();

    expect(store.theme).toBe("dark");
  });

  it("setTheme updates the state, the document attribute and localStorage", () => {
    mockMatchMedia(false);
    const store = useThemeStore();

    store.setTheme("light");

    expect(store.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("torre.theme")).toBe("light");
  });

  it("toggle switches between 'dark' and 'light'", () => {
    mockMatchMedia(false);
    const store = useThemeStore();

    expect(store.theme).toBe("dark");
    store.toggle();
    expect(store.theme).toBe("light");
    store.toggle();
    expect(store.theme).toBe("dark");
  });
});
