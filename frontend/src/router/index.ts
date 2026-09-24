import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AuditLogView from "../views/admin/AuditLogView.vue";
import DashboardLayoutsView from "../views/admin/DashboardLayoutsView.vue";
import UsersView from "../views/admin/UsersView.vue";
import ForgotPasswordView from "../views/auth/ForgotPasswordView.vue";
import LoginView from "../views/auth/LoginView.vue";
import RegisterView from "../views/auth/RegisterView.vue";
import ResetPasswordView from "../views/auth/ResetPasswordView.vue";
import AccountView from "../views/AccountView.vue";
import CoachPlayersView from "../views/coach/CoachPlayersView.vue";
import PanelView from "../views/dashboard/PanelView.vue";
import HomeView from "../views/HomeView.vue";
import ClubsView from "../views/organizer/ClubsView.vue";
import CreateTournamentView from "../views/organizer/CreateTournamentView.vue";
import DashboardView from "../views/organizer/DashboardView.vue";
import TournamentAdminView from "../views/organizer/TournamentAdminView.vue";
import PlayerTournamentsView from "../views/player/PlayerTournamentsView.vue";

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
      component: RegisterView,
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
    },
    {
      path: "/olvide-password",
      name: "forgot-password",
      component: ForgotPasswordView,
    },
    {
      path: "/restablecer-password",
      name: "reset-password",
      component: ResetPasswordView,
    },
    {
      // Every role's dashboard; which widgets it shows is decided per role
      // on the backend (see backend/src/services/dashboard/).
      path: "/panel",
      name: "panel",
      component: PanelView,
      meta: { requiresAuth: true },
    },
    {
      path: "/panel/configuracion",
      name: "dashboard-layouts",
      component: DashboardLayoutsView,
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"] },
    },
    {
      path: "/cuenta",
      name: "account",
      component: AccountView,
      meta: { requiresAuth: true },
    },
    {
      path: "/torneos",
      name: "tournaments-dashboard",
      component: DashboardView,
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/torneos/nuevo",
      name: "tournaments-new",
      component: CreateTournamentView,
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/torneos/:id",
      name: "tournaments-admin",
      component: TournamentAdminView,
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/mis-torneos",
      name: "tournaments-player",
      component: PlayerTournamentsView,
      meta: { requiresAuth: true, roles: ["PLAYER"] },
    },
    {
      path: "/clubes",
      name: "clubs",
      component: ClubsView,
      meta: { requiresAuth: true, roles: TOURNAMENT_ADMIN_ROLES },
    },
    {
      path: "/mis-jugadores",
      name: "coach-players",
      component: CoachPlayersView,
      meta: { requiresAuth: true, roles: ["COACH"] },
    },
    {
      path: "/auditoria",
      name: "audit-log",
      component: AuditLogView,
      meta: { requiresAuth: true, roles: ["ADMINISTRATOR"] },
    },
    {
      path: "/usuarios",
      name: "admin-users",
      component: UsersView,
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
