import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config/env";

// A device token says "this browser has signed in to this account before".
// The login limit lets such a browser keep trying under the per-address
// limit, while every other attempt at the account shares one limit whatever
// address it claims: X-Forwarded-For can be forged by calling the API
// straight on Render, but this token can't (see middlewares/rateLimits.ts).
//
// It carries the account only as a keyed hash, so nobody reading a shared
// computer's cookies learns who signed in there.

const VERSION = "v1";
const LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

// Its own key, derived from the session secret: a device token's signature
// is never one a session token or socket ticket could reuse.
const key = (): Buffer => createHmac("sha256", env.jwtSecret).update("torre-device-token").digest();

const normalize = (email: string): string => email.trim().toLowerCase();

function signature(expires: string, email: string): string {
  return createHmac("sha256", key())
    .update(`${VERSION}.${expires}.${normalize(email)}`)
    .digest("base64url");
}

/** A device token for the account behind `email`, valid for 90 days from `now`. */
export function signDeviceToken(email: string, now: Date = new Date()): string {
  const expires = String(now.getTime() + LIFETIME_MS);
  return `${VERSION}.${expires}.${signature(expires, email)}`;
}

/** Whether `token` is one this API issued for the account behind `email`, and hasn't expired. */
export function isDeviceTokenFor(token: string | null, email: string, now: Date = new Date()): boolean {
  const [version, expires, given, ...rest] = (token ?? "").split(".");
  if (version !== VERSION || !expires || !/^\d+$/.test(expires) || !given || rest.length > 0) return false;
  if (Number(expires) <= now.getTime()) return false;

  const expected = Buffer.from(signature(expires, email));
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
