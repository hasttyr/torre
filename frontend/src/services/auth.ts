import { api } from "./api";

// Deliberately duplicated in backend/src/validators/auth.schemas.ts and
// backend/src/services/auth.service.ts (there is no shared package between
// the two npm projects): if the registration contract changes there,
// replicate the change here.
export const SELF_ASSIGNABLE_ROLES = ["JUGADOR", "ENTRENADOR", "ARBITRO", "ORGANIZADOR"] as const;

export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

interface RegisterBasePayload {
  nombre: string;
  email: string;
  password: string;
}

interface RegisterPlayerPayload extends RegisterBasePayload {
  rol: "JUGADOR";
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

interface RegisterOtherRolePayload extends RegisterBasePayload {
  rol: "ENTRENADOR" | "ARBITRO" | "ORGANIZADOR";
}

export type RegisterPayload = RegisterPlayerPayload | RegisterOtherRolePayload;

// Deliberately duplicated in backend/src/validators/users.schemas.ts
// (GENEROS/DISCAPACIDADES) — closed catalogs, not free text.
export const GENDERS = ["MASCULINO", "FEMENINO", "NO_BINARIO", "PREFIERE_NO_DECIR"] as const;
export type Gender = (typeof GENDERS)[number];

export const DISABILITIES = [
  "NINGUNA",
  "FISICA_MOTRIZ",
  "VISUAL",
  "AUDITIVA",
  "COGNITIVA",
  "PSICOSOCIAL",
  "MULTIPLE",
  "OTRA",
] as const;
export type Disability = (typeof DISABILITIES)[number];

export interface PlayerProfile {
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  fechaNacimiento: string | null;
  edad: number | null;
  genero: Gender | null;
  discapacidad: Disability | null;
}

export interface RegisteredUser {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: string;
  jugador?: PlayerProfile;
}

// HU20: every field is optional (only what is sent gets updated); it never
// includes rol or email on purpose, same rule as
// backend/src/validators/users.schemas.ts. An explicit null clears
// fechaNacimiento/genero/discapacidad; omitting the field leaves it as-is.
export interface UpdateProfilePayload {
  nombre?: string;
  codigoUniversitario?: string;
  programa?: string;
  semestre?: number;
  fechaNacimiento?: string | null;
  genero?: Gender | null;
  discapacidad?: Disability | null;
}

/**
 * Registers a new user account.
 *
 * @param payload - The registration form data. The shape depends on the chosen role:
 * a `JUGADOR` (player) role requires university enrollment details, other roles don't.
 * @returns The newly created user as stored by the backend.
 */
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

/**
 * Logs a user in with email and password.
 *
 * @param payload - The user's credentials.
 * @returns The session token and the authenticated user's data.
 */
export async function loginUser(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>("/auth/login", payload);
  return data;
}

/**
 * Logs the current user out on the backend.
 *
 * @remarks
 * Best-effort call: the backend does not invalidate anything (the JWT is
 * stateless), so a failure here must not block the local logout.
 */
export async function logoutUser(): Promise<void> {
  await api.post("/auth/logout");
}

/**
 * Fetches the currently authenticated user's profile.
 *
 * @returns The current user's data, as known by the backend right now.
 */
export async function fetchMe(): Promise<RegisteredUser> {
  const { data } = await api.get<RegisteredUser>("/users/me");
  return data;
}

/**
 * Updates the currently authenticated user's own profile.
 *
 * @param payload - Only the fields the user is allowed to self-edit; unset fields are left unchanged.
 * @returns The user's data after the update.
 */
export async function updateProfile(payload: UpdateProfilePayload): Promise<RegisteredUser> {
  const { data } = await api.put<RegisteredUser>("/users/me", payload);
  return data;
}
