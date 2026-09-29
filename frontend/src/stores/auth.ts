import { defineStore } from "pinia";

import type { RegisteredUser, UpdateProfilePayload } from "../services/auth";
import { setSignedIn } from "../services/session";

// Who's signed in, for the interface (header, route guards, pages). The
// session itself is an HttpOnly cookie the API sets on sign-in: script can't
// read it, so nothing kept here would let an XSS act as the user.

// The auth endpoints (and axios with them) load on first use: the store is
// part of the app shell, and reading the saved user needs no HTTP client.
const authApi = () => import("../services/auth");

const STORAGE_KEY_USER = "torre.usuario";
// Where an earlier version kept the session token, readable by any script.
const LEGACY_STORAGE_KEY_TOKEN = "torre.token";

interface AuthState {
  user: RegisteredUser | null;
}

/** The signed-in user, as saved on this device, if any. */
function readStorage(): RegisteredUser | null {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY_TOKEN);
    const rawUser = localStorage.getItem(STORAGE_KEY_USER);
    return rawUser ? (JSON.parse(rawUser) as RegisteredUser) : null;
  } catch {
    // localStorage may not be available (private browsing, etc.).
    return null;
  }
}

/** Saves (or forgets) the signed-in user on this device. */
function writeStorage(user: RegisteredUser | null): void {
  try {
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY_USER);
  } catch {
    // No persistence available: the interface keeps working in memory only.
  }
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => {
    const user = readStorage();
    setSignedIn(user !== null);
    return { user };
  },
  getters: {
    isAuthenticated: (state) => state.user !== null,
  },
  actions: {
    /** Signs in with email and password: the server starts the session cookie. */
    async login(email: string, password: string): Promise<void> {
      const { loginUser } = await authApi();
      const { user } = await loginUser({ email, password });
      this.user = user;
      setSignedIn(true);
      writeStorage(user);
    },

    /** Signs out on the server (which revokes the session and clears the cookie), then here. */
    async logout(): Promise<void> {
      try {
        if (this.isAuthenticated) {
          const { logoutUser } = await authApi();
          await logoutUser();
        }
      } catch {
        // Signing out here must not depend on the server answering.
      }
      this.clearSession();
    },

    /** Forgets the session on this device only (e.g. the server already rejected it). */
    clearSession(): void {
      this.user = null;
      setSignedIn(false);
      writeStorage(null);
    },

    /** Re-fetches the current user's profile from the backend. */
    async refreshUser(): Promise<void> {
      const { fetchMe } = await authApi();
      const user = await fetchMe();
      this.user = user;
      writeStorage(user);
    },

    /** Updates the current user's own profile. */
    async updateProfile(payload: UpdateProfilePayload): Promise<void> {
      const { updateProfile } = await authApi();
      const user = await updateProfile(payload);
      this.user = user;
      writeStorage(user);
    },
  },
});
