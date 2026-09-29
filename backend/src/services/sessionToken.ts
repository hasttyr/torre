import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { AuthUser } from "../types/express";

// The one place that knows what a session token looks like: who signs it,
// how, and which claims it carries. Pinned on both ends, so a token signed
// with any other algorithm (e.g. "none") never verifies.
const ALGORITHM = "HS256";
// Who issues a session token and who it's for: a token signed with the same
// secret by or for anything else (another service, another app) never
// passes as a session here.
const ISSUER = "torre-central-hub-api";
const AUDIENCE = "torre-central-hub";
// A socket ticket: a one-minute token that opens one real-time connection
// (the socket may go straight to the API, where the session cookie isn't
// sent). Its own audience keeps it from ever passing as a session.
const SOCKET_AUDIENCE = "torre-central-hub-socket";
const SOCKET_TICKET_SECONDS = 60;
// Tokens signed before these two claims existed carry neither. Those issued
// before this moment (2026-09-28, in JWT seconds) stay valid until they
// expire, so the deploy signs nobody out; once JWT_EXPIRES_IN has passed
// since, this allowance can go.
const CLAIMS_REQUIRED_FROM = Date.UTC(2026, 8, 28) / 1000;

/** Who a session is for, and the account's token version it was issued under. */
export interface SessionClaims {
  user: AuthUser;
  version: number;
}

/**
 * The user-update fragment that ends every session issued so far: each token
 * carries the version it was issued under, and requireAuth only accepts the
 * account's current one. Written in the same update (and transaction) as
 * the change that calls for it.
 */
export const REVOKE_SESSIONS = { tokenVersion: { increment: 1 } } as const;

/** Signs a session token carrying the user's id, role name and current token version. */
export function signSessionToken(user: AuthUser, version = 0): string {
  // The role travels embedded in the token, and requireAuth checks on every
  // request that it still matches the account (and that the account is
  // still active): a role change or a block invalidates the token right
  // away, and the user just logs in again.
  return jwt.sign({ sub: user.id, role: user.role, ver: version }, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: env.jwtExpiresIn,
    issuer: ISSUER,
    audience: AUDIENCE,
  } as jwt.SignOptions);
}

/** Whether the token names this API and app, or predates those claims (see CLAIMS_REQUIRED_FROM). */
function isForThisApp(payload: jwt.JwtPayload): boolean {
  if (payload.iss === ISSUER && payload.aud === AUDIENCE) return true;
  const predatesClaims = typeof payload.iat === "number" && payload.iat < CLAIMS_REQUIRED_FROM;
  return payload.iss === undefined && payload.aud === undefined && predatesClaims;
}

/** Signed claims as SessionClaims, or an error when they aren't a session's shape. */
function claimsOf(payload: jwt.JwtPayload): SessionClaims {
  if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("unexpected token payload shape");
  }
  // Tokens issued before versions existed carry none: they're version 0,
  // which the first revocation of that account retires.
  const version = typeof payload.ver === "number" ? payload.ver : 0;
  return { user: { id: payload.sub, role: payload.role }, version };
}

/** When a session token stops working: the session cookie lasts exactly as long. */
export function sessionExpiresAt(token: string): Date {
  const { exp } = jwt.decode(token) as jwt.JwtPayload;
  return new Date((exp ?? 0) * 1000);
}

/** Signs a ticket for one real-time connection, for a user whose session is current. */
export function signSocketTicket(user: AuthUser, version: number): string {
  return jwt.sign({ sub: user.id, role: user.role, ver: version }, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: SOCKET_TICKET_SECONDS,
    issuer: ISSUER,
    audience: SOCKET_AUDIENCE,
  });
}

/**
 * Verifies a socket ticket (signature, algorithm, expiry, issuer, audience)
 * and returns its claims.
 *
 * @throws {Error} if any of those fail.
 */
export function verifySocketTicket(ticket: string): SessionClaims {
  const payload = jwt.verify(ticket, env.jwtSecret, {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: SOCKET_AUDIENCE,
  });
  if (typeof payload === "string") throw new Error("not a socket ticket");
  return claimsOf(payload);
}

/**
 * Verifies a session token's signature, algorithm, expiry, issuer and
 * audience, and returns its claims.
 *
 * @throws {Error} if any of those fail or the claims aren't the expected shape.
 */
export function verifySessionToken(token: string): SessionClaims {
  const payload = jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] });
  if (typeof payload === "string" || !isForThisApp(payload)) {
    throw new Error("not a session token of this API");
  }
  return claimsOf(payload);
}
