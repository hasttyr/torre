import { defineStore } from "pinia";

import type { RegisteredUser, UpdateProfilePayload } from "../services/auth";
import { setAuthToken } from "../services/session";

// The auth endpoints (and axios with them) load on first use: the store is
// part of the app shell, and reading the saved session needs no HTTP client.
const authApi = () => import("../services/auth");

const STORAGE_KEY_TOKEN = "torre.token";
const STORAGE_KEY_USER = "torre.usuario";

interface AuthState {
  token: string | null;
  user: RegisteredUser | null;
}

/** Reads the persisted session (token + user) from localStorage, if any. */
function readStorage(): AuthState {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const rawUser = localStorage.getItem(STORAGE_KEY_USER);
    return {
      token,
      user: rawUser ? (JSON.parse(rawUser) as RegisteredUser) : null,
    };
  } catch {
    // localStorage may not be available (private browsing, etc.).
    return { token: null, user: null };
  }
}

/** Persists (or clears) the session in localStorage. */
function writeStorage(token: string | null, user: RegisteredUser | null): void {
  try {
    if (token && user) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  } catch {
    // No persistence available; the session keeps working in memory only.
  }
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => {
    const initial = readStorage();
    if (initial.token) {
      setAuthToken(initial.token);
    }
    return initial;
  },
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    /** Logs in with email and password and persists the resulting session. */
    async login(email: string, password: string): Promise<void> {
      const { loginUser } = await authApi();
      const { token, user } = await loginUser({ email, password });
      this.token = token;
      this.user = user;
      setAuthToken(token);
      writeStorage(token, user);
    },

    /** Logs the current user out, both on the backend (best-effort) and locally. */
    async logout(): Promise<void> {
      try {
        if (this.token) {
          const { logoutUser } = await authApi();
          await logoutUser();
        }
      } catch {
        // Stateless JWT: if the call fails, we still clear the local session.
      }
      this.clearSession();
    },

    /** Forgets the session on this device only (e.g. the server already rejected it). */
    clearSession(): void {
      this.token = null;
      this.user = null;
      setAuthToken(null);
      writeStorage(null, null);
    },

    /** Re-fetches the current user's profile from the backend. */
    async refreshUser(): Promise<void> {
      const { fetchMe } = await authApi();
      const user = await fetchMe();
      this.user = user;
      writeStorage(this.token, user);
    },

    /** Updates the current user's own profile. */
    async updateProfile(payload: UpdateProfilePayload): Promise<void> {
      const { updateProfile } = await authApi();
      const user = await updateProfile(payload);
      this.user = user;
      writeStorage(this.token, user);
    },
  },
});
