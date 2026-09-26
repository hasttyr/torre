import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import LoginView from "../views/auth/LoginView.vue";
import HomeView from "../views/HomeView.vue";

// Only the two entry points (landing, login) ship in the initial bundle;
// every other view is its own chunk, fetched the first time it's visited.

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
      meta: { requiresAuth: true },
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
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/torneos/nuevo",
      name: "tournaments-new",
      component: () => import("../views/organizer/CreateTournamentView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/torneos/:id",
      name: "tournaments-admin",
      component: () => import("../views/organizer/TournamentAdminView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      // HU18: any authenticated role follows a tournament here; the backend
      // hides drafts from whoever doesn't manage it.
      path: "/torneos/:id/sala",
      name: "tournament-room",
      component: () => import("../views/tournament/TournamentLiveView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/en-juego",
      name: "live-tournaments",
      component: () => import("../views/tournament/LiveTournamentsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/mis-torneos",
      name: "tournaments-player",
      component: () => import("../views/player/PlayerTournamentsView.vue"),
      meta: { requiresAuth: true, roles: ["PLAYER"] },
    },
    {
      path: "/clubes",
      name: "clubs",
      component: () => import("../views/organizer/ClubsView.vue"),
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/mis-jugadores",
      name: "coach-players",
      component: () => import("../views/coach/CoachPlayersView.vue"),
      meta: { requiresAuth: true, roles: ["COACH"] },
    },
    {
      path: "/auditoria",
      name: "audit-log",
      component: () => import("../views/admin/AuditLogView.vue"),
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"] },
    },
    {
      path: "/usuarios",
      name: "admin-users",
      component: () => import("../views/admin/UsersView.vue"),
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"] },
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

  const roles = to.meta.roles as string[] | undefined;
  if (roles && !roles.includes(auth.user?.role ?? "")) {
    return { path: "/" };
  }

  return true;
});
