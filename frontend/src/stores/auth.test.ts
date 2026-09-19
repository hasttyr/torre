import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/auth", () => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  fetchMe: vi.fn(),
  updateProfile: vi.fn(),
}));

import { api } from "../services/api";
import { fetchMe, loginUser, logoutUser, updateProfile } from "../services/auth";
import { useAuthStore } from "./auth";

const loginUserMock = vi.mocked(loginUser);
const logoutUserMock = vi.mocked(logoutUser);
const fetchMeMock = vi.mocked(fetchMe);
const updateProfileMock = vi.mocked(updateProfile);

const USER = {
  id: "usuario-1",
  name: "Ana Torres",
  email: "ana@example.com",
  status: "ACTIVO",
  role: "ORGANIZADOR",
  createdAt: "2026-01-01T00:00:00.000Z",
};

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
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });

  it("hydrates the session from localStorage when the store is created", () => {
    localStorage.setItem("torre.token", "token-guardado");
    localStorage.setItem("torre.usuario", JSON.stringify(USER));

    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.user).toEqual(USER);
    expect(api.defaults.headers.common.Authorization).toBe("Bearer token-guardado");
  });

  it("login stores the token/user, persists to localStorage and sets the axios header", async () => {
    loginUserMock.mockResolvedValue({ token: "nuevo-token", user: USER });
    const store = useAuthStore();

    await store.login("ana@example.com", "password123");

    expect(store.token).toBe("nuevo-token");
    expect(store.user).toEqual(USER);
    expect(localStorage.getItem("torre.token")).toBe("nuevo-token");
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(USER);
    expect(api.defaults.headers.common.Authorization).toBe("Bearer nuevo-token");
  });

  it("login does not change state when the backend rejects the credentials", async () => {
    loginUserMock.mockRejectedValue(new Error("Credenciales inválidas"));
    const store = useAuthStore();

    await expect(store.login("ana@example.com", "mala")).rejects.toThrow();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("torre.token")).toBeNull();
  });

  it("logout clears state, localStorage and the axios header", async () => {
    loginUserMock.mockResolvedValue({ token: "token", user: USER });
    logoutUserMock.mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    await store.logout();

    expect(logoutUserMock).toHaveBeenCalled();
    expect(store.token).toBeNull();
    expect(store.user).toBeNull();
    expect(localStorage.getItem("torre.token")).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });

  it("logout clears the local session even if the backend call fails", async () => {
    loginUserMock.mockResolvedValue({ token: "token", user: USER });
    logoutUserMock.mockRejectedValue(new Error("Network Error"));
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("torre.token")).toBeNull();
  });

  it("refreshUser updates the profile from /users/me", async () => {
    loginUserMock.mockResolvedValue({ token: "token", user: USER });
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    const updated = { ...USER, name: "Ana T." };
    fetchMeMock.mockResolvedValue(updated);

    await store.refreshUser();

    expect(store.user).toEqual(updated);
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(updated);
  });

  it("updateProfile stores the user returned by the backend (HU20)", async () => {
    loginUserMock.mockResolvedValue({ token: "token", user: USER });
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
