import type { Router } from "vue-router";

import { onUnauthorized } from "../services/session";
import { useAuthStore } from "../stores/auth";

/**
 * When the server stops accepting the session (expired token, blocked
 * account, changed role), drops it locally and sends the user to log in
 * again, back to where they were afterwards.
 *
 * @remarks
 * Only clears the local session: calling the logout endpoint here would
 * itself answer 401 and loop.
 */
export function installSessionExpiryHandler(router: Router): void {
  onUnauthorized(() => {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) return; // several requests failing at once: handle it once
    auth.clearSession();

    const current = router.currentRoute.value;
    if (current.path !== "/login") {
      router.push({ path: "/login", query: { redirect: current.fullPath, expired: "1" } });
    }
  });
}
