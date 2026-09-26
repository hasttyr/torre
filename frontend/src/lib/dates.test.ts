import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatNumericDate, fromIsoDate, numericDatePattern, toIsoDate } from "./dates";

// Colombia (UTC-5): from 19:00 local, UTC is already on the next day, which
// is exactly where toISOString()-based "today" went wrong.
const originalTimeZone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Bogota";
});
afterAll(() => {
  process.env.TZ = originalTimeZone;
});

describe("toIsoDate / fromIsoDate", () => {
  it("uses the viewer's calendar day, not UTC's", () => {
    const eveningInBogota = new Date("2026-09-26T01:30:00.000Z"); // 25 Sep, 20:30 local

    expect(toIsoDate(eveningInBogota)).toBe("2026-09-25");
  });

  it("reads a date-only value as local midnight of that same day", () => {
    const date = fromIsoDate("2026-10-01");

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 1, 0]);
    expect(toIsoDate(date)).toBe("2026-10-01");
  });
});

describe("numericDatePattern", () => {
  it("matches the day/month order each language writes", () => {
    expect(numericDatePattern("es")).toBe("dd/MM/yyyy");
    expect(numericDatePattern("en")).toBe("MM/dd/yyyy");
  });

  it("describes exactly what formatNumericDate writes, so a shown date can be typed back", () => {
    const date = fromIsoDate("2026-10-01");

    expect(formatNumericDate(date, "es")).toBe("01/10/2026");
    expect(formatNumericDate(date, "en")).toBe("10/01/2026");
  });
});
