import type { CookieOptions, NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { HttpError } from "../errors/apiErrors";
import { signDeviceToken } from "../services/deviceToken";
import { sessionExpiresAt } from "../services/sessionToken";

// The browser's session: the token in a cookie that script can't read
// (HttpOnly), that other sites' requests don't carry (SameSite=Lax), that
// only travels over HTTPS in production (Secure), and only to the API
// (Path=/api). It lasts as long as the token inside it. The frontend reaches
// the API on its own site (a /api proxy), so the cookie is first-party.

export const SESSION_COOKIE = "torre_session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function cookieOptions(): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: env.nodeEnv === "production", path: "/api" };
}

/** Starts the browser's session with `token`. */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), expires: sessionExpiresAt(token) });
}

/** Ends the browser's session. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// The browser's device token (services/deviceToken.ts): it outlives the
// session, signing out included, and only the login route ever receives it.
export const DEVICE_COOKIE = "torre_device";
const DEVICE_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Remembers that this browser signed in to the account behind `email`. */
export function setDeviceCookie(res: Response, email: string): void {
  res.cookie(DEVICE_COOKIE, signDeviceToken(email), {
    httpOnly: true,
    sameSite: "strict",
    secure: env.nodeEnv === "production",
    path: "/api/auth/login",
    maxAge: DEVICE_COOKIE_MAX_AGE_MS,
  });
}

/** The value of the request's cookie called `name`, if it carries one. */
function cookieOf(req: Request, name: string): string | null {
  for (const pair of (req.header("cookie") ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator !== -1 && pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return null;
}

/** The session token the request's cookie carries, if any. */
export function sessionCookieOf(req: Request): string | null {
  return cookieOf(req, SESSION_COOKIE);
}

/** The device token the request's cookie carries, if any. */
export function deviceCookieOf(req: Request): string | null {
  return cookieOf(req, DEVICE_COOKIE);
}

/** The origin a request says it comes from: its Origin header, else its Referer's. */
function originOf(req: Request): string | null {
  const origin = req.header("origin");
  if (origin) return origin;
  const referer = req.header("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF protection for the cookie session: a change (not a read) that the
 * session cookie carries must come from one of the app's own origins.
 * SameSite=Lax already keeps the cookie off other sites' requests; this also
 * covers pages that count as the same site (a sibling subdomain). A request
 * without the cookie (a bearer token) isn't one a browser sends on its own.
 *
 * Browsers say where a request comes from in Sec-Fetch-Site, a header no page
 * can set: when it's there, only "same-origin" passes (the cookie belongs to
 * the app's own host, behind the Vercel proxy). Otherwise, an older browser,
 * the Origin (or Referer) must be one of `allowedOrigins`.
 *
 * @param allowedOrigins - The app's origins (CORS_ORIGIN, APP_URL).
 */
export function rejectCrossSiteWrites(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method) || !sessionCookieOf(req)) return next();
    const site = req.header("sec-fetch-site");
    if (site) return next(site === "same-origin" ? undefined : new HttpError("CROSS_SITE_REQUEST"));
    const origin = originOf(req);
    next(origin && allowed.has(origin) ? undefined : new HttpError("CROSS_SITE_REQUEST"));
  };
}
