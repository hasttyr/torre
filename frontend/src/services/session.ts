// Whether this tab has a session, and what to do when the server ends it.
// The session itself is an HttpOnly cookie the API sets: script can't read
// it (an XSS can't steal it), so the app only keeps this flag. Kept apart
// from the HTTP client (api.ts, which pulls in axios) so the app shell can
// use it without downloading axios on the landing and login pages.

let signedIn = false;
let unauthorizedHandler: (() => void) | null = null;

/** Records whether this tab has a session (set on sign-in, cleared on sign-out). */
export function setSignedIn(value: boolean): void {
  signedIn = value;
}

export function isSignedIn(): boolean {
  return signedIn;
}

/**
 * Registers what to do when the server rejects the session (a 401 while
 * signed in): it expired, it was revoked, the account was blocked or its
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
