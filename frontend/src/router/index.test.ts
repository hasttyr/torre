import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Pages' first data requests, started by their routes (see lib/pageData.ts).
vi.mock("../lib/pageData", () => ({
  loadDashboard: vi.fn(() => new Promise(() => {})),
  loadTournamentRoom: vi.fn(() => new Promise(() => {})),
  loadTournamentAdmin: vi.fn(() => new Promise(() => {})),
}));

import { loadDashboard, loadTournamentAdmin, loadTournamentRoom } from "../lib/pageData";
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
        status: "ACTIVE",
        role: "ORGANIZER",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });

    await router.push("/cuenta");

    expect(router.currentRoute.value.path).toBe("/cuenta");
  });
});

describe("router role guards", () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    await router.push("/");
    await router.isReady();
  });

  function signIn(role: string): void {
    useAuthStore().$patch({ token: "token", user: { id: "u-1", name: "Ana", role } as never });
  }

  it("sends a role away from a section it can't open", async () => {
    signIn("PLAYER");

    await router.push("/usuarios");

    expect(router.currentRoute.value.path).toBe("/");
  });

  it("lets the right role into its lazily loaded section", async () => {
    signIn("ADMINISTRATOR");

    await router.push("/panel/configuracion");

    expect(router.currentRoute.value.path).toBe("/panel/configuracion");
  });

  it("opens a tournament's room to any signed-in role (HU18)", async () => {
    signIn("COACH");

    await router.push("/torneos/t-1/sala");

    expect(router.currentRoute.value.path).toBe("/torneos/t-1/sala");
    expect(router.currentRoute.value.params.id).toBe("t-1");
  });
});

describe("router data prefetch", () => {
  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    await router.push("/");
    await router.isReady();
  });

  function signIn(role: string): void {
    useAuthStore().$patch({ token: "token", user: { id: "u-1", name: "Ana", role } as never });
  }

  it("starts each heavy page's data while its code is still downloading", async () => {
    signIn("ADMINISTRATOR");

    await router.push("/panel");
    await router.push("/torneos/t-7/sala");
    await router.push("/torneos/t-8");
    await vi.dynamicImportSettled();

    expect(loadDashboard).toHaveBeenCalledOnce();
    expect(loadTournamentRoom).toHaveBeenCalledWith("t-7");
    expect(loadTournamentAdmin).toHaveBeenCalledWith("t-8");
  });

  it("asks for nothing when the guard sends the visitor to log in", async () => {
    await router.push("/panel");
    await vi.dynamicImportSettled();

    expect(router.currentRoute.value.path).toBe("/login");
    expect(loadDashboard).not.toHaveBeenCalled();
  });
});
