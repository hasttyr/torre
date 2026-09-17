import { defineStore } from "pinia";

export type Theme = "light" | "dark";

const STORAGE_KEY = "torre.theme";

function prefiereClaro(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  } catch {
    return false;
  }
}

function leerThemeGuardado(): Theme | null {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return guardado === "light" || guardado === "dark" ? guardado : null;
  } catch {
    // localStorage puede no estar disponible (navegación privada, etc.).
    return null;
  }
}

function aplicarTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = defineStore("theme", {
  state: (): { theme: Theme } => {
    const theme = leerThemeGuardado() ?? (prefiereClaro() ? "light" : "dark");
    aplicarTheme(theme);
    return { theme };
  },
  actions: {
    setTheme(theme: Theme): void {
      this.theme = theme;
      aplicarTheme(theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Sin persistencia disponible, el tema sigue funcionando solo en esta carga.
      }
    },

    toggle(): void {
      this.setTheme(this.theme === "dark" ? "light" : "dark");
    },
  },
});
