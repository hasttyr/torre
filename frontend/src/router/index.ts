import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import LoginView from "../views/auth/LoginView.vue";
import HomeView from "../views/HomeView.vue";

// Only the two entry points (landing, login) ship in the initial bundle;
// every other view is its own chunk, fetched the first time it's visited.
// The heavier pages also start their data in beforeEnter, which runs before
// the page's chunk downloads, so data and code arrive in parallel.
const tournamentQueries = () => import("../queries/tournaments");
const dashboardQueries = () => import("../queries/dashboard");

// A tournament's id in a URL: nothing else matches the tournament pages, so
// a malformed or crafted id ("..%2Fusers%3F", which vue-router would decode
// into the API path) lands on the not-found page and never reaches the API.
const TOURNAMENT_ID = "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    // Who may open the route (the guard below); omitted = any signed-in user.
    roles?: string[];
    // A section of the header's nav (lib/navigation.ts), in `order`. Its own
    // `roles` narrow who sees the link when that's fewer than who may open it.
    nav?: { labelKey: string; order: number; roles?: string[] };
  }
}

// Roles that manage tournaments (HU04-HU07). Mirrors
// backend/src/routes/tournaments.routes.ts (requireRole("ORGANIZER", "ADMINISTRATOR")).
const TOURNAMENT_ADMIN_ROLES = ["ORGANIZER", "ADMINISTRATOR"];

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/registro",
      name: "register",
      component: () => import("../views/auth/RegisterView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
    },
    {
      path: "/olvide-password",
      name: "forgot-password",
      component: () => import("../views/auth/ForgotPasswordView.vue"),
    },
    {
      path: "/restablecer-password",
      name: "reset-password",
      component: () => import("../views/auth/ResetPasswordView.vue"),
    },
    {
      // Every role's dashboard; which widgets it shows is decided per role
      // on the backend (see backend/src/services/dashboard/).
      path: "/panel",
      name: "panel",
      component: () => import("../views/dashboard/PanelView.vue"),
      meta: { requiresAuth: true, nav: { labelKey: "header.panel", order: 1 } },
      beforeEnter: () => {
        // A failed prefetch leaves it to the page, which loads (or shows the error) itself.
        dashboardQueries()
          .then((queries) => queries.prefetchPanel())
          .catch(() => undefined);
      },
    },
    {
      path: "/panel/configuracion",
      name: "dashboard-layouts",
      component: () => import("../views/admin/DashboardLayoutsView.vue"),
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"] },
    },
    {
      path: "/cuenta",
      name: "account",
      component: () => import("../views/AccountView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/torneos",
      name: "tournaments-dashboard",
      component: () => import("../views/organizer/DashboardView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES, nav: { labelKey: "header.myTournaments", order: 2 } },
    },
    {
      path: "/torneos/nuevo",
      name: "tournaments-new",
      component: () => import("../views/organizer/CreateTournamentView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: `/torneos/:id${TOURNAMENT_ID}`,
      name: "tournaments-admin",
      component: () => import("../views/organizer/TournamentAdminView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
      beforeEnter: (to) => {
        const id = String(to.params.id);
        tournamentQueries()
          .then((queries) => queries.prefetchTournamentAdmin(id))
          .catch(() => undefined);
      },
    },
    {
      // HU18: any authenticated role follows a tournament here; the backend
      // hides drafts from whoever doesn't manage it.
      path: `/torneos/:id${TOURNAMENT_ID}/sala`,
      name: "tournament-room",
      component: () => import("../views/tournament/TournamentLiveView.vue"),
      meta: { requiresAuth: true },
      beforeEnter: (to) => {
        const id = String(to.params.id);
        tournamentQueries()
          .then((queries) => queries.prefetchTournamentRoom(id))
          .catch(() => undefined);
      },
    },
    {
      path: "/en-juego",
      name: "live-tournaments",
      component: () => import("../views/tournament/LiveTournamentsView.vue"),
      // Open to everyone, but only linked for those without "Mis torneos" to follow them from.
      meta: {
        requiresAuth: true,
        nav: { labelKey: "header.live", order: 6, roles: ["PLAYER", "COACH", "ARBITER"] },
      },
    },
    {
      path: "/mis-torneos",
      name: "tournaments-player",
      component: () => import("../views/player/PlayerTournamentsView.vue"),
      meta: { requiresAuth: true, roles: ["PLAYER"], nav: { labelKey: "header.tournaments", order: 4 } },
    },
    {
      path: "/clubes",
      name: "clubs",
      component: () => import("../views/organizer/ClubsView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES, nav: { labelKey: "header.clubs", order: 3 } },
    },
    {
      path: "/mis-jugadores",
      name: "coach-players",
      component: () => import("../views/coach/CoachPlayersView.vue"),
      meta: { requiresAuth: true, roles: ["COACH"], nav: { labelKey: "header.myPlayers", order: 5 } },
    },
    {
      path: "/auditoria",
      name: "audit-log",
      component: () => import("../views/admin/AuditLogView.vue"),
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"], nav: { labelKey: "header.auditLog", order: 8 } },
    },
    {
      path: "/usuarios",
      name: "admin-users",
      component: () => import("../views/admin/UsersView.vue"),
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"], nav: { labelKey: "header.users", order: 7 } },
    },
    {
      // Anything else: a typo, an old link, a malformed id.
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("../views/NotFoundView.vue"),
    },
  ],
});

/**
 * Global navigation guard: blocks routes marked `requiresAuth` for
 * unauthenticated users, and further restricts by role when the route
 * declares `meta.roles`.
 */
router.beforeEach((to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  const { roles } = to.meta;
  if (roles && !roles.includes(auth.user?.role ?? "")) {
    return { path: "/" };
  }

  return true;
});
