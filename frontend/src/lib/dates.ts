import type { SupportedLocale } from "../i18n";

// Calendar-day helpers for date-only form values: the "YYYY-MM-DD" strings
// <DateField> binds, and the numeric day/month/year text its input shows.
//
// A "YYYY-MM-DD" means a day on the viewer's calendar, so both directions go
// through local time: `new Date("2026-10-01")` would be UTC midnight (the
// previous evening in Colombia), and toISOString() is already tomorrow there
// from 19:00.

/** The viewer's local calendar day of `date`, as "YYYY-MM-DD". */
export function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Local midnight of a "YYYY-MM-DD" day. */
export function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

const NUMERIC_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

/** "01/10/2026" in Spanish, "10/01/2026" in English. */
export function formatNumericDate(date: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, NUMERIC_DATE).format(date);
}

const PATTERN_TOKENS: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = { day: "dd", month: "MM", year: "yyyy" };

/**
 * The date-fns pattern for what formatNumericDate writes ("dd/MM/yyyy",
 * "MM/dd/yyyy"), derived from the same Intl formatter so that a date the
 * input shows is always read back as that same date.
 */
export function numericDatePattern(locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, NUMERIC_DATE)
    .formatToParts(new Date(2000, 0, 1))
    .map((part) => PATTERN_TOKENS[part.type] ?? part.value)
    .join("");
}
