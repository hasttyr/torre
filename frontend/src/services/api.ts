import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
});

// Lo llama stores/auth.ts (no un interceptor que lea el store en cada
// request) para evitar un ciclo de imports entre api.ts <-> stores/auth.ts.
export function setAuthToken(token: string | null): void {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
