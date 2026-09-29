import { randomBytes } from "node:crypto";

import type { PrismaClient } from "../generated/prisma/client";

import { DATA_POLICY_VERSION } from "../config/dataPolicy";
import { HttpError } from "../errors/apiErrors";
import type { AuthUser } from "../types/express";
import type { RegisterSchemaInput } from "../validators/auth.schemas";
import { comparePassword, hashPassword, needsRehash } from "./password";
import { isUniqueConstraintError } from "./prismaErrors";
import { REVOKE_SESSIONS, signSessionToken, signSocketTicket } from "./sessionToken";
import { toUserDto, type UserDto } from "./user.mapper";
import type { AuthResult, SocketTicketDto } from "../contracts/responses";

// Derived from the validator instead of re-declared by hand, so the roles a
// person can self-register with (PLAYER, COACH) can't drift from what the
// API actually accepts. acceptDataPolicy (RN-10/HU21) is guaranteed `true`
// by the schema; the service only persists it with a date and version.
export type RegisterUserInput = RegisterSchemaInput;

export interface LoginUserInput {
  email: string;
  password: string;
}

// Made on first use (hashing on import would slow every boot and test run).
let throwawayHash: Promise<string> | undefined;

/** A hash of a random password, in the current scheme: what an unknown email's attempt is checked against. */
function unknownUserHash(): Promise<string> {
  throwawayHash ??= hashPassword(randomBytes(32).toString("hex"));
  return throwawayHash;
}

/**
 * Registers a new user account.
 *
 * @param prisma - The Prisma client to use.
 * @param input - The registration data; its shape depends on the chosen role.
 * @returns The newly created user.
 * @throws {HttpError} 400 if the role doesn't exist, 409 if the email is already registered.
 */
export async function registerUser(prisma: PrismaClient, input: RegisterUserInput): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  const role = await prisma.role.findUnique({ where: { name: input.role } });
  if (!role) {
    throw new HttpError("ROLE_NOT_FOUND", { role: input.role });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError("EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        roleId: role.id,
        dataPolicyAccepted: true,
        dataPolicyAcceptedAt: new Date(),
        dataPolicyVersion: DATA_POLICY_VERSION,
        ...(input.role === "PLAYER"
          ? {
              player: {
                create: {
                  universityCode: input.universityCode.trim(),
                  program: input.program.trim(),
                  semester: input.semester,
                },
              },
            }
          : {}),
      },
      include: { role: true },
    });

    return toUserDto(user);
  } catch (error) {
    // Covers the race between the findUnique above and the create: of two
    // concurrent registrations with the same email, only one can win.
    if (isUniqueConstraintError(error)) {
      throw new HttpError("EMAIL_TAKEN");
    }
    throw error;
  }
}

/**
 * Authenticates a user with email and password.
 *
 * @param prisma - The Prisma client to use.
 * @param input - The user's credentials.
 * @returns A session token and the authenticated user's data.
 * @throws {HttpError} 401 for invalid credentials, 403 if the account is inactive.
 */
/** A successful sign-in: the session token (for the cookie) and the user. */
export interface SignedIn extends AuthResult {
  token: string;
}

export async function loginUser(prisma: PrismaClient, input: LoginUserInput): Promise<SignedIn> {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

  // Same generic message whether the email doesn't exist or the password is
  // wrong: don't reveal whether an account exists (RF02). An unknown email
  // is checked against a throwaway hash, so both cases also take as long.
  const isPasswordValid = await comparePassword(input.password, user?.passwordHash ?? (await unknownUserHash()));
  if (!user || !isPasswordValid) {
    throw new HttpError("INVALID_CREDENTIALS");
  }

  if (user.status !== "ACTIVE") {
    throw new HttpError("ACCOUNT_INACTIVE");
  }

  if (needsRehash(user.passwordHash)) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
  }

  return { token: signSessionToken({ id: user.id, role: user.role.name }, user.tokenVersion), user: toUserDto(user) };
}

/** Ends every session the actor has open, on any device (sign-out). */
export async function revokeSessions(prisma: PrismaClient, actor: AuthUser): Promise<void> {
  await prisma.user.update({ where: { id: actor.id }, data: REVOKE_SESSIONS });
}

/** A one-minute ticket to open a real-time connection as `actor`, under their current session. */
export async function issueSocketTicket(prisma: PrismaClient, actor: AuthUser): Promise<SocketTicketDto> {
  const { tokenVersion } = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { tokenVersion: true },
  });
  return { ticket: signSocketTicket(actor, tokenVersion) };
}

export type { AuthResult };
