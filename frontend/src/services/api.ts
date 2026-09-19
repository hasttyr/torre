import axios from "axios";

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
