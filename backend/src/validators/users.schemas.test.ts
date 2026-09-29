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
});
