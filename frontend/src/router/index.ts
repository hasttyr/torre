import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AccountView from "../views/AccountView.vue";
import CreateTournamentView from "../views/CreateTournamentView.vue";
import DashboardView from "../views/DashboardView.vue";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import TournamentAdminView from "../views/TournamentAdminView.vue";

// Roles que administran torneos (HU04-HU07). Espejo de
// backend/src/routes/torneos.routes.ts (requireRole("ORGANIZADOR", "ADMINISTRADOR")).
const ROLES_ADMIN_TORNEO = ["ORGANIZADOR", "ADMINISTRADOR"];

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
      name: "registro",
      component: RegisterView,
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
    },
    {
      path: "/cuenta",
      name: "cuenta",
      component: AccountView,
      meta: { requiresAuth: true },
    },
    {
      path: "/torneos",
      name: "torneos-dashboard",
      component: DashboardView,
      meta: { requiresAuth: true, roles: ROLES_ADMIN_TORNEO },
    },
    {
      path: "/torneos/nuevo",
      name: "torneos-nuevo",
      component: CreateTournamentView,
      meta: { requiresAuth: true, roles: ROLES_ADMIN_TORNEO },
    },
    {
      path: "/torneos/:id",
      name: "torneos-admin",
      component: TournamentAdminView,
      meta: { requiresAuth: true, roles: ROLES_ADMIN_TORNEO },
    },
  ],
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const auth = useAuthStore();
  if (!auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  const roles = to.meta.roles as string[] | undefined;
  if (roles && !roles.includes(auth.usuario?.rol ?? "")) {
    return { path: "/" };
  }

  return true;
});
