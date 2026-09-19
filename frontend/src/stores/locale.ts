import { defineStore } from "pinia";

import { i18n, type SupportedLocale } from "../i18n";

export type Locale = SupportedLocale;

const STORAGE_KEY = "torre.locale";

function leerLocaleGuardado(): Locale | null {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return guardado === "es" || guardado === "en" ? guardado : null;
  } catch {
    // localStorage puede no estar disponible (navegación privada, etc.).
    return null;
  }
}

function aplicarLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  i18n.global.locale.value = locale;
}

export const useLocaleStore = defineStore("locale", {
  state: (): { locale: Locale } => {
    const locale = leerLocaleGuardado() ?? "es";
    aplicarLocale(locale);
    return { locale };
  },
  actions: {
    setLocale(locale: Locale): void {
      this.locale = locale;
      aplicarLocale(locale);
      try {
        localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // Sin persistencia disponible, el idioma sigue funcionando solo en esta carga.
      }
    },

    toggle(): void {
      this.setLocale(this.locale === "es" ? "en" : "es");
    },
  },
});
