import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { notifyUnauthorized } from "../services/session";
import { useAuthStore } from "../stores/auth";
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
  });

  it("drops the local session and sends the user to log in, then back where they were", async () => {
    const router = await setup("/torneos/t-1/sala");
    const auth = useAuthStore();
    auth.$patch({ token: "stale", user: { id: "u-1", name: "Ana", role: "ARBITER" } as never });

    notifyUnauthorized();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe("/login"));

    expect(auth.isAuthenticated).toBe(false);
    expect(router.currentRoute.value.query).toEqual({ redirect: "/torneos/t-1/sala", expired: "1" });
  });

  it("does nothing once the session is already gone (several requests failing together)", async () => {
    const router = await setup("/panel");
    const push = vi.spyOn(router, "push");

    notifyUnauthorized();

    expect(push).not.toHaveBeenCalled();
  });
});
