// Where each role lands right after logging in or registering. Mirrors the
// role-gated routes in router/index.ts: every path here must be one that
// role is actually allowed to see.
const ROLE_HOME_PATHS: Record<string, string> = {
  PLAYER: "/mis-torneos",
  COACH: "/mis-jugadores",
  ORGANIZER: "/torneos",
  ADMINISTRATOR: "/torneos",
  // ARBITER has no dedicated dashboard yet (its HUs aren't built): the
  // account page is a safe, always-authorized landing spot.
  ARBITER: "/cuenta",
};

/** Resolves the landing path for a freshly authenticated user, based on their role. */
export function roleHomePath(role: string): string {
  return ROLE_HOME_PATHS[role] ?? "/cuenta";
}
