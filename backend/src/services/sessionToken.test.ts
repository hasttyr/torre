import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sessionExpiresAt,
  signSessionToken,
  signSocketTicket,
  verifySessionToken,
  verifySocketTicket,
} from "./sessionToken";

// The day tokens started carrying an issuer and an audience.
const BEFORE_CLAIMS = new Date("2026-09-27T12:00:00Z");
const AFTER_CLAIMS = new Date("2026-09-29T12:00:00Z");

/** A token as the API signed them before issuers and audiences, at the current (fake) time. */
const legacyToken = (payload: object = { sub: "user-1", role: "COACH" }) =>
  jwt.sign(payload, "test-secret", { expiresIn: "1h" });

describe("session tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("carry who the session is for and the account's token version", () => {
    const token = signSessionToken({ id: "user-1", role: "COACH" }, 3);

    expect(verifySessionToken(token)).toEqual({ user: { id: "user-1", role: "COACH" }, version: 3 });
  });

  it("name this API as their issuer and the app as their audience", () => {
    const claims = jwt.decode(signSessionToken({ id: "user-1", role: "COACH" })) as jwt.JwtPayload;

    expect(claims.iss).toBe("torre-central-hub-api");
    expect(claims.aud).toBe("torre-central-hub");
  });

  it("refuse a token signed with the same secret for someone else", () => {
    const options = { expiresIn: "1h" } as const;
    const forOtherApp = jwt.sign({ sub: "user-1", role: "COACH" }, "test-secret", {
      ...options,
      issuer: "torre-central-hub-api",
      audience: "another-app",
    });
    const byOtherService = jwt.sign({ sub: "user-1", role: "COACH" }, "test-secret", {
      ...options,
      issuer: "another-service",
      audience: "torre-central-hub",
    });

    expect(() => verifySessionToken(forOtherApp)).toThrow();
    expect(() => verifySessionToken(byOtherService)).toThrow();
  });

  it("accept a token issued before the claims existed until it expires, so deploying doesn't sign everyone out", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_CLAIMS);

    // Issued before versions existed too: it reads as version 0.
    expect(verifySessionToken(legacyToken())).toEqual({ user: { id: "user-1", role: "COACH" }, version: 0 });
  });

  it("refuse a token without the claims issued since they exist", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AFTER_CLAIMS);

    expect(() => verifySessionToken(legacyToken())).toThrow();
  });

  it("refuse a token whose claims aren't a session's", () => {
    const other = jwt.sign({ purpose: "something else" }, "test-secret", {
      expiresIn: "1h",
      issuer: "torre-central-hub-api",
      audience: "torre-central-hub",
    });

    expect(() => verifySessionToken(other)).toThrow();
  });
});

describe("socket tickets", () => {
  it("carry who the connection is for, briefly", () => {
    const ticket = signSocketTicket({ id: "user-1", role: "ARBITER" }, 2);
    const claims = jwt.decode(ticket) as jwt.JwtPayload;

    expect(verifySocketTicket(ticket)).toEqual({ user: { id: "user-1", role: "ARBITER" }, version: 2 });
    expect(claims.exp! - claims.iat!).toBe(60);
  });

  it("aren't sessions, and sessions aren't tickets", () => {
    const ticket = signSocketTicket({ id: "user-1", role: "ARBITER" }, 0);
    const session = signSessionToken({ id: "user-1", role: "ARBITER" }, 0);

    expect(() => verifySessionToken(ticket)).toThrow();
    expect(() => verifySocketTicket(session)).toThrow();
  });
});

describe("sessionExpiresAt", () => {
  it("is when the session token stops working", () => {
    const token = signSessionToken({ id: "user-1", role: "COACH" });
    const { exp } = jwt.decode(token) as jwt.JwtPayload;

    expect(sessionExpiresAt(token)).toEqual(new Date(exp! * 1000));
  });
});
