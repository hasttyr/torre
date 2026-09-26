import axios, { type AxiosError } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
});

/**
 * Sets or clears the Authorization header used on every request.
 *
 * @remarks
 * Called by stores/auth.ts (instead of an interceptor that reads the store
 * on each request) to avoid an import cycle between api.ts and stores/auth.ts.
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registers what to do when the server rejects the session (401 on a
 * request that carried a token): the token expired, the account was blocked
 * or its role changed (backend/src/middlewares/auth.ts). Registered once, by
 * lib/sessionExpiry.ts — same no-import-cycle reason as setAuthToken.
 */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(undefined, (error: AxiosError) => {
  // A 401 without a token (e.g. wrong password on login) is just an answer,
  // not an expired session.
  const hadSession = Boolean(error.config?.headers?.Authorization);
  if (error.response?.status === 401 && hadSession) {
    unauthorizedHandler?.();
  }
  return Promise.reject(error);
});
