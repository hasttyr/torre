import { defineStore } from "pinia";

export type Theme = "light" | "dark";

const STORAGE_KEY = "torre.theme";

/** Detects whether the OS/browser prefers a light color scheme. */
function prefersLight(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  } catch {
    return false;
  }
}

/** Reads the persisted theme preference from localStorage, if any. */
function readSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    // localStorage may not be available (private browsing, etc.).
    return null;
  }
}

// Each theme's page background (--bg in style.css; index.html sets the
// first paint's value): the browser tints its address bar and task
// switcher with it.
const THEME_COLOR: Record<Theme, string> = { dark: "#0f1115", light: "#f7f5f0" };

/** Applies the theme to the document so CSS (and the browser's chrome) can react to it. */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export const useThemeStore = defineStore("theme", {
  state: (): { theme: Theme } => {
    const theme = readSavedTheme() ?? (prefersLight() ? "light" : "dark");
    applyTheme(theme);
    return { theme };
  },
  actions: {
    /** Sets and persists the active theme. */
    setTheme(theme: Theme): void {
      this.theme = theme;
      applyTheme(theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // No persistence available; the theme keeps working for this load only.
      }
    },

    /** Toggles between light and dark themes. */
    toggle(): void {
      this.setTheme(this.theme === "dark" ? "light" : "dark");
    },
  },
});
