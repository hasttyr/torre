import { defineStore } from "pinia";

import { setAuthToken } from "../services/api";
import {
  fetchMe,
  loginUser,
  logoutUser,
  updateProfile,
  type RegisteredUser,
  type UpdateProfilePayload,
} from "../services/auth";

const STORAGE_KEY_TOKEN = "torre.token";
const STORAGE_KEY_USUARIO = "torre.usuario";

interface AuthState {
  token: string | null;
  usuario: RegisteredUser | null;
}

function readStorage(): AuthState {
  try {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const rawUsuario = localStorage.getItem(STORAGE_KEY_USUARIO);
    return {
      token,
      usuario: rawUsuario ? (JSON.parse(rawUsuario) as RegisteredUser) : null,
    };
  } catch {
    // localStorage puede no estar disponible (navegación privada, etc.).
    return { token: null, usuario: null };
  }
}

function writeStorage(token: string | null, usuario: RegisteredUser | null): void {
  try {
    if (token && usuario) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_USUARIO, JSON.stringify(usuario));
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USUARIO);
    }
  } catch {
    // Sin persistencia disponible, la sesión sigue funcionando solo en memoria.
  }
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => {
    const initial = readStorage();
    if (initial.token) {
      setAuthToken(initial.token);
    }
    return initial;
  },
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
  },
  actions: {
    async login(email: string, password: string): Promise<void> {
      const { token, usuario } = await loginUser({ email, password });
      this.token = token;
      this.usuario = usuario;
      setAuthToken(token);
      writeStorage(token, usuario);
    },

    async logout(): Promise<void> {
      try {
        if (this.token) {
          await logoutUser();
        }
      } catch {
        // JWT sin estado: si la llamada falla igual limpiamos la sesión local.
      }
      this.token = null;
      this.usuario = null;
      setAuthToken(null);
      writeStorage(null, null);
    },

    async refreshUsuario(): Promise<void> {
      const usuario = await fetchMe();
      this.usuario = usuario;
      writeStorage(this.token, usuario);
    },

    async updateProfile(payload: UpdateProfilePayload): Promise<void> {
      const usuario = await updateProfile(payload);
      this.usuario = usuario;
      writeStorage(this.token, usuario);
    },
  },
});
