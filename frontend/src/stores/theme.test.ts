import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThemeStore } from "./theme";

function mockMatchMedia(prefiereClaro: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: light)" ? prefiereClaro : false,
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

  it("usa 'dark' por defecto cuando no hay preferencia guardada ni del sistema", () => {
    mockMatchMedia(false);

    const store = useThemeStore();

    expect(store.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("respeta la preferencia del sistema (claro) si no hay nada guardado", () => {
    mockMatchMedia(true);

    const store = useThemeStore();

    expect(store.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("prioriza el tema guardado en localStorage sobre la preferencia del sistema", () => {
    mockMatchMedia(true);
    localStorage.setItem("torre.theme", "dark");

    const store = useThemeStore();

    expect(store.theme).toBe("dark");
  });

  it("setTheme actualiza el estado, el atributo del documento y localStorage", () => {
    mockMatchMedia(false);
    const store = useThemeStore();

    store.setTheme("light");

    expect(store.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("torre.theme")).toBe("light");
  });

  it("toggle alterna entre 'dark' y 'light'", () => {
    mockMatchMedia(false);
    const store = useThemeStore();

    expect(store.theme).toBe("dark");
    store.toggle();
    expect(store.theme).toBe("light");
    store.toggle();
    expect(store.theme).toBe("dark");
  });
});
