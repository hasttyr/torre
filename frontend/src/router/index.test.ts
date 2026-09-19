import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "../stores/auth";
import { router } from "./index";

describe("router guard de /cuenta", () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await router.push("/");
    await router.isReady();
  });

  it("redirige a /login cuando no hay sesión", async () => {
    await router.push("/cuenta");

    expect(router.currentRoute.value.path).toBe("/login");
    expect(router.currentRoute.value.query.redirect).toBe("/cuenta");
  });

  it("deja pasar cuando hay una sesión activa", async () => {
    const auth = useAuthStore();
    auth.$patch({
      token: "token",
      user: {
        id: "usuario-1",
        nombre: "Ana",
        email: "ana@example.com",
        estado: "ACTIVO",
        rol: "ORGANIZADOR",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await router.push("/cuenta");

    expect(router.currentRoute.value.path).toBe("/cuenta");
  });
});
