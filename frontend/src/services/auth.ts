import { api } from "./api";

// Duplicado deliberadamente en backend/src/validators/auth.schemas.ts y
// backend/src/services/auth.service.ts (no hay paquete compartido entre los
// dos proyectos npm): si el contrato de registro cambia allá, replicá el
// cambio acá.
export const ROLES_AUTOASIGNABLES = ["JUGADOR", "ENTRENADOR", "ARBITRO", "ORGANIZADOR"] as const;

export type RolAutoasignable = (typeof ROLES_AUTOASIGNABLES)[number];

interface RegisterBasePayload {
  nombre: string;
  email: string;
  password: string;
}

interface RegisterJugadorPayload extends RegisterBasePayload {
  rol: "JUGADOR";
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

interface RegisterOtroRolPayload extends RegisterBasePayload {
  rol: "ENTRENADOR" | "ARBITRO" | "ORGANIZADOR";
}

export type RegisterPayload = RegisterJugadorPayload | RegisterOtroRolPayload;

export interface RegisteredUser {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: string;
}

export async function registerUser(payload: RegisterPayload): Promise<RegisteredUser> {
  const { data } = await api.post<RegisteredUser>("/auth/register", payload);
  return data;
}
