// Calendar days as the university lives them. A date that is a day (a
// tournament's start or end, a birth date) is stored at UTC midnight, and
// "today" is Colombia's, whatever the server's time zone: read with the
// local zone, a day would slip to the one before (or after).

export const DAY_MS = 24 * 60 * 60 * 1000;
// Colombia is UTC-5 all year (no daylight saving).
export const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Today's calendar day in Bogotá, stored like a tournament date: at UTC midnight. */
export function todayInBogota(now = new Date()): Date {
  const local = now.getTime() - BOGOTA_OFFSET_MS;
  return new Date(local - (local % DAY_MS));
}
