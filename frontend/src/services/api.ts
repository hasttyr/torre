import axios, { type AxiosError } from "axios";

import { isSignedIn, notifyUnauthorized } from "./session";

// Always the API on the app's own site: /api, which the dev server, `vite
// preview` and Vercel (vercel.json) proxy to the backend. That makes the
// session cookie first-party, so browsers send it (they block third-party
// ones). Not configurable: the backend's own address would lose the cookie.
export const api = axios.create({ baseURL: "/api" });

api.interceptors.response.use(undefined, (error: AxiosError) => {
  // A 401 while signed out (a wrong password on login) is just an answer,
  // not an expired session.
  if (error.response?.status === 401 && isSignedIn()) {
    notifyUnauthorized();
  }
  return Promise.reject(error);
});

/**
 * Builds an API path, encoding every value put into it: an id with "/", "?"
 * or "#" (say, from a crafted URL) stays one path segment instead of
 * pointing the request at another endpoint (client-side path traversal).
 *
 * @example path`/tournaments/${id}/rounds`
 */
export function path(segments: TemplateStringsArray, ...values: (string | number)[]): string {
  return String.raw({ raw: segments }, ...values.map((value) => encodeURIComponent(value)));
}
