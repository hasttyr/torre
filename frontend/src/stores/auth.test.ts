import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/auth", () => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  fetchMe: vi.fn(),
  updateProfile: vi.fn(),
}));

import { fetchMe, loginUser, logoutUser, updateProfile } from "../services/auth";
import type { RegisteredUser } from "../services/auth";
import { isSignedIn } from "../services/session";
import { useAuthStore } from "./auth";

const loginUserMock = vi.mocked(loginUser);
const logoutUserMock = vi.mocked(logoutUser);
const fetchMeMock = vi.mocked(fetchMe);
const updateProfileMock = vi.mocked(updateProfile);

const USER: RegisteredUser = {
  id: "usuario-1",
  name: "Ana Torres",
  email: "ana@example.com",
  status: "ACTIVE",
  role: "ORGANIZER",
  createdAt: "2026-01-01T00:00:00.000Z",
  dataConsent: { accepted: true, date: "2026-01-01T00:00:00.000Z", version: "2026-08-01" },
};

// The session itself is an HttpOnly cookie the API sets and script can't
// read: the store only keeps who's signed in, for the interface.
describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("starts with no session when localStorage is empty", () => {
    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(isSignedIn()).toBe(false);
  });

  it("picks the signed-in user up again when the app reloads", () => {
    localStorage.setItem("torre.usuario", JSON.stringify(USER));

    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.user).toEqual(USER);
    expect(isSignedIn()).toBe(true);
  });

  it("throws away a session token an earlier version left in storage, where script could read it", () => {
    localStorage.setItem("torre.token", "old-token");
    localStorage.setItem("torre.usuario", JSON.stringify(USER));

    useAuthStore();

    expect(localStorage.getItem("torre.token")).toBeNull();
  });

  it("signs in: keeps the user, and nothing that would let script act as them", async () => {
    loginUserMock.mockResolvedValue({ user: USER });
    const store = useAuthStore();

    await store.login("ana@example.com", "password123");

    expect(store.user).toEqual(USER);
    expect(isSignedIn()).toBe(true);
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(USER);
    expect(Object.keys(localStorage)).toEqual(["torre.usuario"]);
  });

  it("doesn't change anything when the backend rejects the credentials", async () => {
    loginUserMock.mockRejectedValue(new Error("Credenciales inválidas"));
    const store = useAuthStore();

    await expect(store.login("ana@example.com", "mala")).rejects.toThrow();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("torre.usuario")).toBeNull();
  });

  it("signs out on the server (which ends the cookie) and forgets the user here", async () => {
    loginUserMock.mockResolvedValue({ user: USER });
    logoutUserMock.mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    await store.logout();

    expect(logoutUserMock).toHaveBeenCalled();
    expect(store.user).toBeNull();
    expect(isSignedIn()).toBe(false);
    expect(localStorage.getItem("torre.usuario")).toBeNull();
  });

  it("forgets the user here even if the server can't be reached to sign out", async () => {
    loginUserMock.mockResolvedValue({ user: USER });
    logoutUserMock.mockRejectedValue(new Error("Network Error"));
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("torre.usuario")).toBeNull();
  });

  it("keeps the session in memory when the browser won't store anything (private browsing)", async () => {
    const refuse = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(refuse);
    loginUserMock.mockResolvedValue({ user: USER });
    try {
      const store = useAuthStore();
      expect(store.isAuthenticated).toBe(false);

      await store.login("ana@example.com", "password123");

      expect(store.user).toEqual(USER);
      expect(isSignedIn()).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("doesn't call the server to sign out when nobody is signed in", async () => {
    const store = useAuthStore();

    await store.logout();

    expect(logoutUserMock).not.toHaveBeenCalled();
    expect(store.isAuthenticated).toBe(false);
  });

  it("refreshUser updates the profile from /users/me", async () => {
    loginUserMock.mockResolvedValue({ user: USER });
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    const updated = { ...USER, name: "Ana T." };
    fetchMeMock.mockResolvedValue(updated);

    await store.refreshUser();

    expect(store.user).toEqual(updated);
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(updated);
  });

  it("updateProfile stores the user returned by the backend (HU20)", async () => {
    loginUserMock.mockResolvedValue({ user: USER });
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    const updated = { ...USER, name: "Ana T." };
    updateProfileMock.mockResolvedValue(updated);

    await store.updateProfile({ name: "Ana T." });

    expect(updateProfileMock).toHaveBeenCalledWith({ name: "Ana T." });
    expect(store.user).toEqual(updated);
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(updated);
  });
});
