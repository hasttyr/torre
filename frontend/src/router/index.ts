import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import AccountView from "../views/AccountView.vue";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";

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

  return true;
});
