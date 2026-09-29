import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../errors/apiErrors";
import { verifySessionToken, verifySocketTicket, type SessionClaims } from "../services/sessionToken";
import type { AuthUser } from "../types/express";
import { sessionCookieOf } from "./sessionCookie";

/**
 * The request's session token: the browser's session cookie, or a bearer
 * token in the Authorization header (clients that aren't browsers).
 */
function extractToken(req: Request): string | null {
  const header = req.header("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  return sessionCookieOf(req);
}

/** Verifies a token with `verify` and returns its claims, as a 401 when it doesn't hold. */
function verifyToken(token: string, verify: (token: string) => SessionClaims = verifySessionToken): SessionClaims {
  try {
    return verify(token);
  } catch {
    throw new HttpError("INVALID_TOKEN");
  }
}

/**
 * Checks that the token's claims still hold: the account exists, is ACTIVE,
 * still has the role the token carries, and hasn't revoked its sessions
 * since the token was issued (password reset, sign-out, role or status
 * change). Without this, a blocked account (admin action, HU22 suppression)
 * or a leaked token would keep working until it expired. One primary-key
 * lookup per request.
 */
async function assertSessionStillValid({ user, version }: SessionClaims): Promise<void> {
  const current = await prisma.user.findFirst({
    where: { id: user.id, status: "ACTIVE", role: { name: user.role }, tokenVersion: version },
    select: { id: true },
  });
  if (!current) {
    throw new HttpError("SESSION_REVOKED");
  }
}

/**
 * Who a session token belongs to, once it's verified and still current.
 * Shared by HTTP requests and Socket.IO handshakes.
 *
 * @throws {HttpError} 401 if the token is invalid, expired or revoked.
 */
export async function authenticateToken(token: string): Promise<AuthUser> {
  const claims = verifyToken(token);
  await assertSessionStillValid(claims);
  return claims.user;
}

/**
 * Who a Socket.IO handshake's ticket belongs to, while the session that
 * asked for it is still current.
 *
 * @throws {HttpError} 401 if the ticket is invalid, expired or its session revoked.
 */
export async function authenticateSocketTicket(ticket: string): Promise<AuthUser> {
  const claims = verifyToken(ticket, verifySocketTicket);
  await assertSessionStillValid(claims);
  return claims.user;
}

async function authenticate(req: Request): Promise<AuthUser> {
  const token = extractToken(req);
  if (!token) {
    throw new HttpError("UNAUTHENTICATED");
  }
  return authenticateToken(token);
}

/** Express middleware: rejects the request unless it carries a valid, still-current JWT, and populates `req.user`. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  authenticate(req).then((user) => {
    req.user = user;
    next();
  }, next);
}

/** Express middleware factory: rejects the request unless `req.user.role` is one of the given roles. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError("UNAUTHENTICATED"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError("FORBIDDEN"));
      return;
    }
    next();
  };
}

/**
 * Who the request is authenticated as. For controllers behind requireAuth;
 * on a route that forgot it, a clean 401 instead of a crash.
 *
 * @throws {HttpError} 401 if the request isn't authenticated.
 */
export function actorOf(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError("UNAUTHENTICATED");
  }
  return req.user;
}
