import { createI18n } from "vue-i18n";

import en from "./locales/en.json";
import es from "./locales/es.json";

export type MessageSchema = typeof es;
export type SupportedLocale = "es" | "en";

export const i18n = createI18n({
  legacy: false,
  locale: "es" as SupportedLocale,
  fallbackLocale: "es" as SupportedLocale,
  messages: { es, en },
});
