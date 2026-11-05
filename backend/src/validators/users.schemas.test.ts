import { afterEach, describe, expect, it, vi } from "vitest";

import { updateProfileSchema } from "./users.schemas";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("updateProfileSchema birthDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("measures 'not in the future' against the moment of the request, not when the server started", () => {
    // The server has been up for two days: a date from yesterday is in the past now.
    vi.useFakeTimers({ now: Date.now() + 2 * DAY_MS });
    const yesterday = new Date(Date.now() - DAY_MS);

    expect(updateProfileSchema.safeParse({ birthDate: yesterday.toISOString() }).success).toBe(true);
  });

  it("rejects a birth date in the future", () => {
    const tomorrow = new Date(Date.now() + DAY_MS);

    const parsed = updateProfileSchema.safeParse({ birthDate: tomorrow.toISOString() });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("La fecha de nacimiento no puede ser futura");
  });

  // A birth date is a calendar day, stored as UTC midnight: read in Colombia
  // (UTC-5) it would fall on the day before, and 1900-01-01 on 1899.
  it("accepts the first day of 1900 whatever the server's time zone", () => {
    expect(updateProfileSchema.safeParse({ birthDate: "1900-01-01" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ birthDate: "1899-12-31" }).success).toBe(false);
  });
});
