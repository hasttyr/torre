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

const USUARIO = {
  id: "usuario-1",
  nombre: "Ana Torres",
  email: "ana@example.com",
  estado: "ACTIVO",
  rol: "ORGANIZADOR",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("arranca sin sesión cuando localStorage está vacío", () => {
    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(false);
    expect(store.usuario).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });

  it("hidrata la sesión desde localStorage al crear el store", () => {
    localStorage.setItem("torre.token", "token-guardado");
    localStorage.setItem("torre.usuario", JSON.stringify(USUARIO));

    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.usuario).toEqual(USUARIO);
    expect(api.defaults.headers.common.Authorization).toBe("Bearer token-guardado");
  });

  it("login guarda token/usuario, persiste en localStorage y setea el header de axios", async () => {
    loginUserMock.mockResolvedValue({ token: "nuevo-token", usuario: USUARIO });
    const store = useAuthStore();

    await store.login("ana@example.com", "password123");

    expect(store.token).toBe("nuevo-token");
    expect(store.usuario).toEqual(USUARIO);
    expect(localStorage.getItem("torre.token")).toBe("nuevo-token");
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(USUARIO);
    expect(api.defaults.headers.common.Authorization).toBe("Bearer nuevo-token");
  });

  it("login no modifica el estado si el backend rechaza las credenciales", async () => {
    loginUserMock.mockRejectedValue(new Error("Credenciales inválidas"));
    const store = useAuthStore();

    await expect(store.login("ana@example.com", "mala")).rejects.toThrow();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("torre.token")).toBeNull();
  });

  it("logout limpia el estado, localStorage y el header de axios", async () => {
    loginUserMock.mockResolvedValue({ token: "token", usuario: USUARIO });
    logoutUserMock.mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    await store.logout();

    expect(logoutUserMock).toHaveBeenCalled();
    expect(store.token).toBeNull();
    expect(store.usuario).toBeNull();
    expect(localStorage.getItem("torre.token")).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });

  it("logout limpia la sesión local aunque la llamada al backend falle", async () => {
    loginUserMock.mockResolvedValue({ token: "token", usuario: USUARIO });
    logoutUserMock.mockRejectedValue(new Error("Network Error"));
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("torre.token")).toBeNull();
  });

  it("refreshUsuario actualiza el perfil desde /users/me", async () => {
    loginUserMock.mockResolvedValue({ token: "token", usuario: USUARIO });
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    const actualizado = { ...USUARIO, nombre: "Ana T." };
    fetchMeMock.mockResolvedValue(actualizado);

    await store.refreshUsuario();

    expect(store.usuario).toEqual(actualizado);
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(actualizado);
  });

  it("updateProfile guarda el usuario devuelto por el backend (HU20)", async () => {
    loginUserMock.mockResolvedValue({ token: "token", usuario: USUARIO });
    const store = useAuthStore();
    await store.login("ana@example.com", "password123");

    const actualizado = { ...USUARIO, nombre: "Ana T." };
    updateProfileMock.mockResolvedValue(actualizado);

    await store.updateProfile({ nombre: "Ana T." });

    expect(updateProfileMock).toHaveBeenCalledWith({ nombre: "Ana T." });
    expect(store.usuario).toEqual(actualizado);
    expect(JSON.parse(localStorage.getItem("torre.usuario")!)).toEqual(actualizado);
  });
});
