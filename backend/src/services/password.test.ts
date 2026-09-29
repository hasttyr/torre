import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { comparePassword, hashPassword, needsRehash } from "./password";

describe("hashPassword / comparePassword", () => {
  it("accepts the password a hash was made from and rejects any other", async () => {
    const hash = await hashPassword("correct horse battery");

    expect(await comparePassword("correct horse battery", hash)).toBe(true);
    expect(await comparePassword("correct horse batterY", hash)).toBe(false);
  });

  it("never stores the password itself, and salts each hash", async () => {
    const first = await hashPassword("password123");
    const second = await hashPassword("password123");

    expect(first).not.toContain("password123");
    expect(first).not.toBe(second);
  });

  it("tells apart long passwords that only differ after byte 72 (bcrypt would treat them as one)", async () => {
    const prefix = "a".repeat(72);
    const hash = await hashPassword(`${prefix}-first`);

    expect(await comparePassword(`${prefix}-second`, hash)).toBe(false);
  });

  it("still accepts a password hashed with bcrypt before the switch", async () => {
    const legacy = await bcrypt.hash("password123", 4);

    expect(await comparePassword("password123", legacy)).toBe(true);
    expect(await comparePassword("password124", legacy)).toBe(false);
  });

  it("rejects, rather than throws on, a stored value that isn't a known hash", async () => {
    expect(await comparePassword("password123", "not-a-hash")).toBe(false);
    expect(await comparePassword("password123", "scrypt$16384$8$5$c2FsdA")).toBe(false);
  });
});

describe("needsRehash", () => {
  it("flags a bcrypt hash for an upgrade and leaves a current one alone", async () => {
    expect(needsRehash(await bcrypt.hash("password123", 4))).toBe(true);
    expect(needsRehash(await hashPassword("password123"))).toBe(false);
  });
});
