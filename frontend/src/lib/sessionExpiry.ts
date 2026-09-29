import type { Router } from "vue-router";

import { onUnauthorized } from "../services/session";
import { useAuthStore } from "../stores/auth";
import { loadPage } from "./pageLoad";

/**
 * When the server stops accepting the session (expired or revoked token,
 * blocked account, changed role), drops it locally and loads the login page
 * afresh, back to where the user was afterwards.
 *
 * @remarks
 * A full page load, not an in-app navigation: whatever the previous session
 * had in memory (stores, cached queries) goes with it. Only clears the local
 * session: calling the logout endpoint here would itself answer 401 and loop.
 */
export function installSessionExpiryHandler(router: Router): void {
  onUnauthorized(() => {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) return; // several requests failing at once: handle it once
    auth.clearSession();

    const current = router.currentRoute.value;
    const query = current.path === "/login" ? current.query : { redirect: current.fullPath, expired: "1" };
    loadPage(router.resolve({ path: "/login", query }).href);
  });
}
