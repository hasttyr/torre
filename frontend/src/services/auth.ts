import { api } from "./api";

// Deliberately duplicated in backend/src/validators/auth.schemas.ts and
// backend/src/services/auth.service.ts (there is no shared package between
// the two npm projects): if the registration contract changes there,
// replicate the change here.
export const SELF_ASSIGNABLE_ROLES = ["PLAYER", "COACH", "ARBITER", "ORGANIZER"] as const;

export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

interface RegisterBasePayload {
  name: string;
  email: string;
  password: string;
  // RN-10/HU21: el registro no se completa sin esta aceptación explícita.
  acceptDataPolicy: true;
}

interface RegisterPlayerPayload extends RegisterBasePayload {
  role: "PLAYER";
  universityCode: string;
  program: string;
  semester: number;
}

interface RegisterOtherRolePayload extends RegisterBasePayload {
  role: "COACH" | "ARBITER" | "ORGANIZER";
}

export type RegisterPayload = RegisterPlayerPayload | RegisterOtherRolePayload;

// Deliberately duplicated in backend/src/validators/users.schemas.ts
// (GENEROS/DISCAPACIDADES) — closed catalogs, not free text.
export const GENDERS = ["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"] as const;
export type Gender = (typeof GENDERS)[number];

export const DISABILITIES = [
  "NONE",
  "PHYSICAL_MOTOR",
  "VISUAL",
  "HEARING",
  "COGNITIVE",
  "PSYCHOSOCIAL",
  "MULTIPLE",
  "OTHER",
] as const;
export type Disability = (typeof DISABILITIES)[number];

export interface PlayerProfile {
  universityCode: string;
  program: string;
  semester: number;
  birthDate: string | null;
  age: number | null;
  gender: Gender | null;
  disability: Disability | null;
}

// HU22 ("conocer"): cuándo y bajo qué versión de la política el titular
// aceptó el tratamiento de sus datos (RN-10/HU21).
export interface DataConsent {
  accepted: boolean;
  date: string | null;
  version: string | null;
}

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  createdAt: string;
  dataConsent: DataConsent;
  player?: PlayerProfile;
}

// HU20: every field is optional (only what is sent gets updated); it never
// includes role or email on purpose, same rule as
// backend/src/validators/users.schemas.ts. An explicit null clears
// birthDate/gender/disability; omitting the field leaves it as-is.
export interface UpdateProfilePayload {
  name?: string;
  universityCode?: string;
  program?: string;
  semester?: number;
  birthDate?: string | null;
  gender?: Gender | null;
  disability?: Disability | null;
}

/**
 * Registers a new user account.
 *
 * @param payload - The registration form data. The shape depends on the chosen role:
 * a `PLAYER` role requires university enrollment details, other roles don't.
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
  user: RegisteredUser;
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

/**
 * Requests a password-reset link for the given email (HU19).
 *
 * @remarks
 * The backend always responds the same way whether or not the email is
 * registered, so this never reveals whether an account exists.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post("/auth/password/forgot", { email });
}

/** Confirms a password reset with the one-time token from the reset link (HU19). */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/password/reset", { token, newPassword });
}
