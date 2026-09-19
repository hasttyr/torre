import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AccountView from "../views/AccountView.vue";
import CreateTournamentView from "../views/CreateTournamentView.vue";
import DashboardView from "../views/DashboardView.vue";
import ForgotPasswordView from "../views/ForgotPasswordView.vue";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import PlayerTournamentsView from "../views/PlayerTournamentsView.vue";
import RegisterView from "../views/RegisterView.vue";
import ResetPasswordView from "../views/ResetPasswordView.vue";
import TournamentAdminView from "../views/TournamentAdminView.vue";

// Roles that manage tournaments (HU04-HU07). Mirrors
// backend/src/routes/torneos.routes.ts (requireRole("ORGANIZADOR", "ADMINISTRADOR")).
const TOURNAMENT_ADMIN_ROLES = ["ORGANIZADOR", "ADMINISTRADOR"];

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
      meta: { requiresAuth: true, roles: ["JUGADOR"] },
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
