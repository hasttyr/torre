import { defineStore } from "pinia";

import { i18n, type SupportedLocale } from "../i18n";

export type Locale = SupportedLocale;

const STORAGE_KEY = "torre.locale";

/** Reads the persisted language preference from localStorage, if any. */
function readSavedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "es" || saved === "en" ? saved : null;
  } catch {
    // localStorage may not be available (private browsing, etc.).
    return null;
  }
}

/** Applies the locale to the document and the i18n instance. */
function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  i18n.global.locale.value = locale;
}

export const useLocaleStore = defineStore("locale", {
  state: (): { locale: Locale } => {
    const locale = readSavedLocale() ?? "es";
    applyLocale(locale);
    return { locale };
  },
  actions: {
    /** Sets and persists the active language. */
    setLocale(locale: Locale): void {
      this.locale = locale;
      applyLocale(locale);
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // No persistence available; the language keeps working for this load only.
      }
    },

    /** Toggles between Spanish and English. */
    toggle(): void {
      this.setLocale(this.locale === "es" ? "en" : "es");
    },
  },
});
