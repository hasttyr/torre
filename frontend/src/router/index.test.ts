import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "../stores/auth";
import { router } from "./index";

describe("router guard for /cuenta", () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await router.push("/");
    await router.isReady();
  });

  it("redirects to /login when there is no session", async () => {
    await router.push("/cuenta");

    expect(router.currentRoute.value.path).toBe("/login");
    expect(router.currentRoute.value.query.redirect).toBe("/cuenta");
  });

  it("lets the request through when there is an active session", async () => {
    const auth = useAuthStore();
    auth.$patch({
      token: "token",
      user: {
        id: "usuario-1",
        name: "Ana",
        email: "ana@example.com",
        status: "ACTIVO",
        role: "ORGANIZADOR",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await router.push("/cuenta");

    expect(router.currentRoute.value.path).toBe("/cuenta");
  });
});
