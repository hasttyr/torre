import { describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory } from "vue-router";

import { prefetchRoute } from "./prefetchRoute";

function makeRouter(loadClubs: () => Promise<unknown>) {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/clubes", component: loadClubs },
    ],
  });
}

describe("prefetchRoute", () => {
  it("starts downloading a lazily loaded page's code before the click", () => {
    const loadClubs = vi.fn(() => Promise.resolve({ default: { template: "<div />" } }));

    prefetchRoute(makeRouter(loadClubs), "/clubes");

    expect(loadClubs).toHaveBeenCalledOnce();
  });

  it("does nothing for a page that's already in the bundle, or a path with no page", () => {
    const loadClubs = vi.fn(() => Promise.resolve({ default: {} }));
    const router = makeRouter(loadClubs);

    expect(() => {
      prefetchRoute(router, "/");
      prefetchRoute(router, "/no-existe");
    }).not.toThrow();
    expect(loadClubs).not.toHaveBeenCalled();
  });

  it("swallows a failed prefetch: the real navigation will retry and report it", async () => {
    const loadClubs = vi.fn(() => Promise.reject(new Error("offline")));

    prefetchRoute(makeRouter(loadClubs), "/clubes");
    await Promise.resolve();

    expect(loadClubs).toHaveBeenCalledOnce();
  });
});
