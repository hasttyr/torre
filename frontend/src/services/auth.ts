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

// Duplicado deliberadamente en backend/src/validators/users.schemas.ts
// (GENEROS/DISCAPACIDADES) — catálogos cerrados, no texto libre.
export const GENEROS = ["MASCULINO", "FEMENINO", "NO_BINARIO", "PREFIERE_NO_DECIR"] as const;
export type Genero = (typeof GENEROS)[number];

export const GENERO_LABELS: Record<Genero, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  NO_BINARIO: "No binario",
  PREFIERE_NO_DECIR: "Prefiero no decir",
};

export const DISCAPACIDADES = [
  "NINGUNA",
  "FISICA_MOTRIZ",
  "VISUAL",
  "AUDITIVA",
  "COGNITIVA",
  "PSICOSOCIAL",
  "MULTIPLE",
  "OTRA",
] as const;
export type Discapacidad = (typeof DISCAPACIDADES)[number];

export const DISCAPACIDAD_LABELS: Record<Discapacidad, string> = {
  NINGUNA: "Ninguna",
  FISICA_MOTRIZ: "Física o motriz",
  VISUAL: "Visual",
  AUDITIVA: "Auditiva",
  COGNITIVA: "Cognitiva",
  PSICOSOCIAL: "Psicosocial",
  MULTIPLE: "Múltiple",
  OTRA: "Otra",
};

export interface JugadorPerfil {
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  fechaNacimiento: string | null;
  edad: number | null;
  genero: Genero | null;
  discapacidad: Discapacidad | null;
}

export interface RegisteredUser {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: string;
  jugador?: JugadorPerfil;
}

// HU20: todos opcionales (se actualiza solo lo que venga); nunca incluye
// rol ni email a propósito, mismo criterio que backend/src/validators/users.schemas.ts.
// null explícito limpia fechaNacimiento/genero/discapacidad; omitir el
// campo lo deja como está.
export interface UpdateProfilePayload {
  nombre?: string;
  codigoUniversitario?: string;
  programa?: string;
  semestre?: number;
  fechaNacimiento?: string | null;
  genero?: Genero | null;
  discapacidad?: Discapacidad | null;
}

export async function registerUser(payload: RegisterPayload): Promise<RegisteredUser> {
  const { data } = await api.post<RegisteredUser>("/auth/register", payload);
  return data;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  usuario: RegisteredUser;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>("/auth/login", payload);
  return data;
}

// Best-effort: el backend no invalida nada (JWT sin estado), así que un
// fallo acá no debe bloquear el logout del lado del cliente.
export async function logoutUser(): Promise<void> {
  await api.post("/auth/logout");
}

export async function fetchMe(): Promise<RegisteredUser> {
  const { data } = await api.get<RegisteredUser>("/users/me");
  return data;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<RegisteredUser> {
  const { data } = await api.put<RegisteredUser>("/users/me", payload);
  return data;
}
