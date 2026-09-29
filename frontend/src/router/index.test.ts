import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Pages' first data requests, started by their routes (see queries/tournaments.ts
// and queries/dashboard.ts).
vi.mock("../queries/tournaments", () => ({
  prefetchTournamentRoom: vi.fn(),
  prefetchTournamentAdmin: vi.fn(),
}));
vi.mock("../queries/dashboard", () => ({ prefetchPanel: vi.fn() }));

import { prefetchPanel } from "../queries/dashboard";
import { prefetchTournamentAdmin, prefetchTournamentRoom } from "../queries/tournaments";
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
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana", role } as never });
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

    await router.push("/torneos/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/sala");

    expect(router.currentRoute.value.path).toBe("/torneos/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/sala");
    expect(router.currentRoute.value.params.id).toBe("3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b");
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
    useAuthStore().$patch({ user: { id: "u-1", name: "Ana", role } as never });
  }

  it("starts each heavy page's data while its code is still downloading", async () => {
    signIn("ADMINISTRATOR");

    await router.push("/panel");
    await router.push("/torneos/7c9e6679-7425-40de-944b-e07fc1f90ae7/sala");
    await router.push("/torneos/8d0f7780-8536-41ef-a55c-f18fd2fa1bf8");
    await vi.dynamicImportSettled();

    expect(prefetchPanel).toHaveBeenCalledOnce();
    expect(prefetchTournamentRoom).toHaveBeenCalledWith("7c9e6679-7425-40de-944b-e07fc1f90ae7");
    expect(prefetchTournamentAdmin).toHaveBeenCalledWith("8d0f7780-8536-41ef-a55c-f18fd2fa1bf8");
  });

  it("asks for nothing when the guard sends the visitor to log in", async () => {
    await router.push("/panel");
    await vi.dynamicImportSettled();

    expect(router.currentRoute.value.path).toBe("/login");
    expect(prefetchPanel).not.toHaveBeenCalled();
  });

  it("still opens the page when its prefetch fails, leaving the loading to the page", async () => {
    signIn("ADMINISTRATOR");
    vi.mocked(prefetchPanel).mockImplementationOnce(() => {
      throw new Error("chunk gone");
    });

    await router.push("/panel");
    await vi.dynamicImportSettled();

    expect(router.currentRoute.value.path).toBe("/panel");
  });
});

describe("routes that don't exist", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("shows the not-found page for a URL no route matches, instead of an empty screen", () => {
    expect(router.resolve("/esto-no-existe").name).toBe("not-found");
  });

  it("doesn't take anything but a tournament id as a tournament, so it never reaches the API", () => {
    expect(router.resolve("/torneos/not-a-uuid/sala").name).toBe("not-found");
    expect(router.resolve("/torneos/..%2Fusers%3F/sala").name).toBe("not-found");
    expect(router.resolve("/torneos/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/sala").name).toBe("tournament-room");
  });

  it("still tells the new-tournament page apart from a tournament", () => {
    expect(router.resolve("/torneos/nuevo").name).toBe("tournaments-new");
  });
});
