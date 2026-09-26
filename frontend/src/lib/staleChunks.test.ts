import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouter, createWebHistory, type Router } from "vue-router";

import { installStaleChunkRecovery } from "./staleChunks";

// What Vite does when a lazily loaded file is gone: it reports
// vite:preloadError, and the import rejects.
const chunkGone = () => {
  window.dispatchEvent(new Event("vite:preloadError"));
  return Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
};

describe("installStaleChunkRecovery", () => {
  let router: Router;
  let uninstall: () => void;
  const loadPage = vi.fn();

  beforeEach(async () => {
    sessionStorage.clear();
    loadPage.mockClear();
    vi.useFakeTimers({ toFake: ["Date"] });
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: "/panel", component: { template: "<div />" } },
        { path: "/torneos", component: { template: "<div />" } },
        { path: "/clubes", component: chunkGone },
      ],
    });
    await router.push("/panel");
    uninstall = installStaleChunkRecovery(router, loadPage);
  });

  afterEach(() => {
    uninstall();
    vi.useRealTimers();
  });

  it("opens a page whose code a deploy replaced as a full page load, landing on that page", async () => {
    await router.push("/clubes").catch(() => undefined);

    expect(loadPage).toHaveBeenCalledExactlyOnceWith("/clubes");
  });

  it("never reloads on a failed prefetch; the next navigation loads fresh, where the user was going", async () => {
    // A hover prefetch hit a replaced file: nothing happens under the pointer.
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(loadPage).not.toHaveBeenCalled();

    await router.push("/torneos?estado=activos");

    expect(loadPage).toHaveBeenCalledExactlyOnceWith("/torneos?estado=activos");
    expect(router.currentRoute.value.path).toBe("/panel");
  });

  it("leaves navigation alone while no file is missing", async () => {
    await router.push("/torneos");

    expect(loadPage).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe("/torneos");
  });

  it("loads fresh at most once every ten seconds: a file broken for real mustn't loop", async () => {
    await router.push("/clubes").catch(() => undefined);
    await router.push("/clubes").catch(() => undefined);
    expect(loadPage).toHaveBeenCalledOnce();

    vi.setSystemTime(Date.now() + 10_001);
    await router.push("/clubes").catch(() => undefined);
    expect(loadPage).toHaveBeenCalledTimes(2);
  });

  it("lets the error show when storage is blocked, since it couldn't tell a loop apart", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    await router.push("/clubes").catch(() => undefined);

    expect(loadPage).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
