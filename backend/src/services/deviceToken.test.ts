import { describe, expect, it } from "vitest";

import { isDeviceTokenFor, signDeviceToken } from "./deviceToken";

const DAY_MS = 24 * 60 * 60 * 1000;
const ISSUED = new Date("2026-10-01T12:00:00Z");

describe("device tokens", () => {
  it("vouch for the account they were issued to, however its email is written", () => {
    const token = signDeviceToken("ana@example.com", ISSUED);

    expect(isDeviceTokenFor(token, "  ANA@Example.com ", ISSUED)).toBe(true);
  });

  it("don't vouch for any other account", () => {
    const token = signDeviceToken("ana@example.com", ISSUED);

    expect(isDeviceTokenFor(token, "luis@example.com", ISSUED)).toBe(false);
  });

  it("stop vouching 90 days after they were issued", () => {
    const token = signDeviceToken("ana@example.com", ISSUED);

    expect(isDeviceTokenFor(token, "ana@example.com", new Date(ISSUED.getTime() + 89 * DAY_MS))).toBe(true);
    expect(isDeviceTokenFor(token, "ana@example.com", new Date(ISSUED.getTime() + 91 * DAY_MS))).toBe(false);
  });

  it("refuse anything this API didn't sign", () => {
    const token = signDeviceToken("ana@example.com", ISSUED);
    const lastChar = token.at(-1) === "a" ? "b" : "a";
    // A later expiry with the original signature.
    const [version, expires, signature] = token.split(".");
    const extended = [version, String(Number(expires) + 365 * DAY_MS), signature].join(".");

    for (const forged of [token.slice(0, -1) + lastChar, extended, "abc", "", null]) {
      expect(isDeviceTokenFor(forged, "ana@example.com", ISSUED)).toBe(false);
    }
  });

  // The cookie stays in the browser after signing out: on a shared lab
  // computer, whoever comes next mustn't read who signed in from it.
  it("carry no email that someone reading the cookie jar could see", () => {
    const token = signDeviceToken("ana@example.com", ISSUED);

    expect(token).not.toContain("ana");
    expect(token).not.toContain(Buffer.from("ana@example.com").toString("base64url"));
  });
});
