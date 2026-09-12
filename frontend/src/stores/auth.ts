import { defineStore } from "pinia";

interface AuthState {
  token: string | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    token: null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    setToken(token: string | null) {
      this.token = token;
    },
  },
});
