import {
  DISABILITIES,
  GENDERS,
  SELF_ASSIGNABLE_ROLES,
  type AuthResult as AuthResultDto,
  type SocketTicketDto,
  type DataConsentDto,
  type Disability,
  type Gender,
  type MyCoachDto,
  type PlayerClubDto,
  type PlayerProfileDto,
  type SelfAssignableRole,
  type UserDto,
} from "@contracts";

import type { Serialized } from "../lib/serialized";
import { api, path } from "./api";

export { DISABILITIES, GENDERS, SELF_ASSIGNABLE_ROLES, type Disability, type Gender, type SelfAssignableRole };
export type PlayerClub = Serialized<PlayerClubDto>;
export type PlayerProfile = Serialized<PlayerProfileDto>;
export type DataConsent = Serialized<DataConsentDto>;
export type RegisteredUser = Serialized<UserDto>;
export type AuthResult = Serialized<AuthResultDto>;
type SocketTicket = Serialized<SocketTicketDto>;
export type MyCoach = Serialized<MyCoachDto>;

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
  role: "COACH";
}

export type RegisterPayload = RegisterPlayerPayload | RegisterOtherRolePayload;

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

/**
 * Logs a user in with email and password. The server starts the session
 * with an HttpOnly cookie: the answer carries only the user.
 *
 * @param payload - The user's credentials.
 */
export async function loginUser(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>("/auth/login", payload);
  return data;
}

/** Ends the session on every device: the server revokes it and clears the cookie. */
export async function logoutUser(): Promise<void> {
  await api.post("/auth/logout");
}

/**
 * A one-minute ticket to open a real-time connection as the signed-in user:
 * the socket may go straight to the API, where the session cookie isn't sent.
 */
export async function requestSocketTicket(): Promise<string> {
  const { data } = await api.post<SocketTicket>("/auth/socket-ticket");
  return data.ticket;
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

/** Lists the coaches who follow the current user (as a player, HU24), and the requests waiting for them. */
export async function listMyCoaches(): Promise<MyCoach[]> {
  const { data } = await api.get<MyCoach[]>("/users/me/coaches");
  return data;
}

/** Accepts a coach's request: from now on they follow the current user's progress (HU24). */
export async function acceptMyCoach(coachId: string): Promise<void> {
  await api.post(path`/users/me/coaches/${coachId}/accept`);
}

/** Declines a coach's request, or stops a coach from following the current user's progress (HU24). */
export async function removeMyCoach(coachId: string): Promise<void> {
  await api.delete(path`/users/me/coaches/${coachId}`);
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
