import { useAuthStore } from "../stores/auth";
import { loadPage } from "./pageLoad";

/**
 * Signs the user out for good: the server revokes the session (on every
 * device), and the app starts over from a fresh page load, so nothing the
 * user saw (stores, cached queries, a socket room) survives in memory for
 * whoever uses this browser next — the university's shared lab computers.
 */
export async function signOut(): Promise<void> {
  await useAuthStore().logout();
  loadPage("/");
}
