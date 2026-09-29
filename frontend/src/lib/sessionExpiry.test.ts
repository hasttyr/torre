import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

vi.mock("./pageLoad", () => ({ loadPage: vi.fn() }));

import { notifyUnauthorized } from "../services/session";
import { useAuthStore } from "../stores/auth";
import { loadPage } from "./pageLoad";
import { installSessionExpiryHandler } from "./sessionExpiry";

async function setup(path: string) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:any(.*)*", component: { template: "<div />" } }],
  });
  await router.push(path);
  installSessionExpiryHandler(router);
  return router;
}

describe("installSessionExpiryHandler", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("drops the session and loads the login page afresh, back where the user was afterwards", async () => {
    await setup("/torneos/t-1/sala");
    const auth = useAuthStore();
    auth.$patch({ user: { id: "u-1", name: "Ana", role: "ARBITER" } as never });

    notifyUnauthorized();

    expect(auth.isAuthenticated).toBe(false);
    // A full load: whatever the previous session had in memory goes with it.
    expect(loadPage).toHaveBeenCalledOnce();
    const target = new URL(vi.mocked(loadPage).mock.calls[0]![0], "http://localhost");
    expect(target.pathname).toBe("/login");
    expect(Object.fromEntries(target.searchParams)).toEqual({ redirect: "/torneos/t-1/sala", expired: "1" });
  });

  it("does nothing once the session is already gone (several requests failing together)", async () => {
    await setup("/panel");

    notifyUnauthorized();

    expect(loadPage).not.toHaveBeenCalled();
  });
});
