import axios, { type AxiosError } from "axios";

import { getAuthToken, notifyUnauthorized } from "./session";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
});

// The token lives in session.ts (no axios there, so the app shell can set it
// without loading this module): it's read fresh on every request.
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, (error: AxiosError) => {
  // A 401 without a token (e.g. wrong password on login) is just an answer,
  // not an expired session.
  const hadSession = Boolean(error.config?.headers?.Authorization);
  if (error.response?.status === 401 && hadSession) {
    notifyUnauthorized();
  }
  return Promise.reject(error);
});
