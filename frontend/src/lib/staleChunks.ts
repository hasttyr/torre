import type { Router } from "vue-router";

import { loadPage } from "./pageLoad";

// Kept in sessionStorage: it has to survive the page load it guards.
const LOADED_AT_KEY = "torre.chunkReloadAt";
const MIN_INTERVAL_MS = 10_000;

/**
 * Recovers a tab opened before a deploy. Its lazily loaded pages and
 * components point at files the deploy replaced (their names carry a
 * content hash), so loading one fails; Vite reports it as
 * `vite:preloadError`. From then on, navigating is a full page load of the
 * destination — fresh index.html and code — instead of an in-app one: the
 * navigation that hit the missing file lands where the user was going, and
 * a failed prefetch (a hover) changes nothing until the user navigates.
 *
 * At most one such load every ten seconds, so a file that's broken for
 * real shows its error instead of loading forever.
 *
 * @returns A function that uninstalls it.
 */
export function installStaleChunkRecovery(router: Router, load: (path: string) => void = loadPage): () => void {
  let stale = false;
  const onPreloadError = (): void => {
    stale = true;
  };

  /** Loads `path` fresh, unless the loop guard (or blocked storage) says not to. */
  function loadFresh(path: string): boolean {
    try {
      const last = Number(sessionStorage.getItem(LOADED_AT_KEY)) || 0;
      if (Date.now() - last <= MIN_INTERVAL_MS) return false;
      sessionStorage.setItem(LOADED_AT_KEY, String(Date.now()));
    } catch {
      // Storage blocked: without the guard it could loop, so let the error show.
      return false;
    }
    load(path);
    return true;
  }

  window.addEventListener("vite:preloadError", onPreloadError);
  // A later navigation: cancel it in the app and load the destination fresh.
  const removeGuard = router.beforeEach((to) => (stale && loadFresh(to.fullPath) ? false : undefined));
  // The navigation that hit the missing file.
  const removeErrorHandler = router.onError((_error, to) => {
    if (stale) loadFresh(to.fullPath);
  });

  return () => {
    window.removeEventListener("vite:preloadError", onPreloadError);
    removeGuard();
    removeErrorHandler();
  };
}
