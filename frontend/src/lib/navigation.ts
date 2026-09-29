import type { RouteRecordNormalized } from "vue-router";

export interface NavLink {
  to: string;
  labelKey: string;
}

/**
 * The header's links for a role, from the routes themselves: those that
 * declare `meta.nav`, visible to the role (the nav's own `roles` if the link
 * is narrower than the route, otherwise the route's `meta.roles`), in order.
 */
export function navLinks(routes: readonly RouteRecordNormalized[], role: string | undefined): NavLink[] {
  return routes
    .flatMap((route) => (route.meta.nav ? [{ route, nav: route.meta.nav }] : []))
    .filter(({ route, nav }) => {
      const roles = nav.roles ?? route.meta.roles;
      return !roles || (role !== undefined && roles.includes(role));
    })
    .sort((a, b) => a.nav.order - b.nav.order)
    .map(({ route, nav }) => ({ to: route.path, labelKey: nav.labelKey }));
}
