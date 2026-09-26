import { createI18n } from "vue-i18n";

import es from "./locales/es.json";

export type MessageSchema = typeof es;
export type SupportedLocale = "es" | "en";

// Only Spanish (the default) ships in the initial bundle; English is its own
// chunk, fetched the first time someone picks it (stores/locale.ts).
export const i18n = createI18n({
  legacy: false,
  locale: "es" as SupportedLocale,
  fallbackLocale: "es" as SupportedLocale,
  // Typed for both languages; English's entry is filled in by loadLocaleMessages.
  messages: { es } as Record<SupportedLocale, MessageSchema>,
});

const loaders: Record<SupportedLocale, () => Promise<{ default: MessageSchema }>> = {
  es: async () => ({ default: es }),
  en: () => import("./locales/en.json"),
};

/** Makes a language's messages available, downloading them the first time. */
export async function loadLocaleMessages(locale: SupportedLocale): Promise<void> {
  if (i18n.global.availableLocales.includes(locale)) return;
  const { default: messages } = await loaders[locale]();
  i18n.global.setLocaleMessage(locale, messages);
}
