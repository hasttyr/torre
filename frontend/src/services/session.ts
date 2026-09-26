// The session's bearer token and what to do when the server rejects it.
// Kept apart from the HTTP client (api.ts, which pulls in axios) so the app
// shell — auth store, session-expiry handling — can use them without
// downloading axios on the landing and login pages: api.ts reads them on
// every request once some page actually calls the API.

let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** Sets or clears the token sent as `Authorization: Bearer …` on every request. */
export function setAuthToken(value: string | null): void {
  token = value;
}

export function getAuthToken(): string | null {
  return token;
}

/**
 * Registers what to do when the server rejects the session (401 on a request
 * that carried a token): the token expired, the account was blocked or its
 * role changed (backend/src/middlewares/auth.ts). Registered once, by
 * lib/sessionExpiry.ts.
 */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/** Called by the HTTP client when the server rejects the session. */
export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
