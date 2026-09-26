import { defineStore } from "pinia";

import { i18n, loadLocaleMessages, type SupportedLocale } from "../i18n";

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

// Picking a language may wait for its messages to download: only the latest
// pick gets applied, so a slow load can't override a later choice.
let latestPick = 0;

/** Loads the language's messages and applies it to the document and the i18n instance. */
async function applyLocale(locale: Locale): Promise<boolean> {
  const pick = ++latestPick;
  await loadLocaleMessages(locale);
  if (pick !== latestPick) return false;
  document.documentElement.lang = locale;
  i18n.global.locale.value = locale;
  return true;
}

export const useLocaleStore = defineStore("locale", {
  state: (): { locale: Locale } => ({ locale: readSavedLocale() ?? "es" }),
  actions: {
    /** Applies the saved (or default) language. main.ts awaits it before mounting, so every page starts in it. */
    async init(): Promise<void> {
      await applyLocale(this.locale);
    },

    /** Sets and persists the active language (English's messages load the first time). */
    async setLocale(locale: Locale): Promise<void> {
      if (!(await applyLocale(locale))) return;
      this.locale = locale;
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // No persistence available; the language keeps working for this load only.
      }
    },

    /** Toggles between Spanish and English. */
    toggle(): Promise<void> {
      return this.setLocale(this.locale === "es" ? "en" : "es");
    },
  },
});
