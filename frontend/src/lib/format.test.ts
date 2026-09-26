import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatDate, formatLocalDate, formatNumber, formatPercent, formatResult, formatShortDate } from "./format";

// The app is used in Colombia (UTC-5). Tournament dates are stored as UTC
// midnight, so formatting them in the browser's zone showed the previous
// day ("15 oct" rendered as "14 oct") — these run in Bogotá time on purpose.
const originalTimeZone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Bogota";
});
afterAll(() => {
  process.env.TZ = originalTimeZone;
});

describe("formatDate", () => {
  it("shows a tournament's calendar day as stored, whatever the viewer's time zone", () => {
    expect(new Date("2026-10-15T00:00:00.000Z").getTimezoneOffset()).toBe(300);
    expect(formatDate("2026-10-15T00:00:00.000Z", "es")).toContain("15");
    expect(formatShortDate("2026-01-01T00:00:00.000Z", "es")).toContain("26");
  });
});

describe("formatLocalDate", () => {
  it("dates a moment by the viewer's day, not UTC's", () => {
    const eveningInBogota = "2026-09-24T01:00:00.000Z"; // 23 Sep, 20:00 local

    expect(formatLocalDate(eveningInBogota, "es")).toContain("23");
    expect(formatDate(eveningInBogota, "es")).toContain("24");
  });
});

describe("formatNumber / formatPercent / formatResult", () => {
  it("uses the locale's decimal separator and the requested precision", () => {
    expect(formatNumber(16.5, "es")).toBe("16,5");
    expect(formatNumber(12.25, "es")).toBe("12,3");
    expect(formatNumber(12.25, "es", 2)).toBe("12,25");
    expect(formatNumber(3, "en")).toBe("3");
  });

  it("formats ratios as whole percentages, and a missing one as a dash", () => {
    expect(formatPercent(0.574, "en")).toBe("57%");
    expect(formatPercent(null, "es")).toBe("—");
  });

  it("writes results in chess notation", () => {
    expect(formatResult("1-0")).toBe("1 – 0");
    expect(formatResult("1/2-1/2")).toBe("½ – ½");
    expect(formatResult("0-1")).toBe("0 – 1");
    expect(formatResult("BYE")).toBe("BYE");
  });
});
