// Locale-aware display formatting shared by the dashboard widgets.

// Tournament dates are calendar days stored as UTC midnight: formatting
// them in the browser's zone would show the previous day west of UTC
// (e.g. Colombia), so date-only values are formatted in UTC.

/** "15 oct 2025" style date, for date-only values. */
export function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "30 sept, 10:54" style timestamp, in the viewer's time zone. */
export function formatDateTime(date: string, locale: string): string {
  return new Date(date).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "oct 25" style short date, for chart axes. */
export function formatShortDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
}

/** A 0-1 ratio as a whole percentage ("57 %"), or an em dash when there's no value. */
export function formatPercent(ratio: number | null, locale: string): string {
  return ratio === null ? "—" : new Intl.NumberFormat(locale, { style: "percent" }).format(ratio);
}

/** A number with at most `maxDecimals` decimals ("16,5" in Spanish). */
export function formatNumber(value: number, locale: string, maxDecimals = 1): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(value);
}

// Chess notation for a result, with typographic dashes and ½.
const RESULT_DISPLAY: Record<string, string> = { "1-0": "1 – 0", "0-1": "0 – 1", "1/2-1/2": "½ – ½" };

/** "1 – 0" / "½ – ½" / "0 – 1" for a stored result value. */
export function formatResult(value: string): string {
  return RESULT_DISPLAY[value] ?? value;
}
