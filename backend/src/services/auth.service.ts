import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

import { DATA_POLICY_VERSION } from "../config/dataPolicy";
import { env } from "../config/env";
import { HttpError } from "../middlewares/errorHandler";
import { comparePassword, hashPassword } from "./password";
import { toUserDto, type UserDto } from "./user.mapper";

interface RegisterUserBase {
  name: string;
  email: string;
  password: string;
  // RN-10/HU21: garantizado `true` por registerSchema (z.literal(true)); el
  // servicio no vuelve a validarlo, solo lo persiste con fecha y versión.
  acceptDataPolicy: true;
}

interface RegisterPlayerInput extends RegisterUserBase {
  role: "JUGADOR";
  universityCode: string;
  program: string;
  semester: number;
}

interface RegisterOtherRoleInput extends RegisterUserBase {
  role: "ORGANIZADOR" | "ARBITRO" | "ENTRENADOR";
}

export type RegisterUserInput = RegisterPlayerInput | RegisterOtherRoleInput;

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: UserDto;
}

/** Checks whether a Prisma error is a unique-constraint violation (P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/** Signs a JWT carrying the user's id and role name. */
function signToken(user: { id: string; rol: { nombre: string } }): string {
  // The role travels embedded in the token (it isn't re-read from the DB on
  // every request): if an admin changes someone's role, that person only
  // sees it reflected on their next login, not immediately. Standard
  // stateless-JWT trade-off, acceptable with a short expiration (1d).
  return jwt.sign({ sub: user.id, rol: user.rol.nombre }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
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

  const role = await prisma.rol.findUnique({ where: { nombre: input.role } });
  if (!role) {
    throw new HttpError(400, `El rol "${input.role}" no existe. Verificá que el seed de roles se haya ejecutado.`);
  }

  const existingUser = await prisma.usuario.findUnique({ where: { email } });
  if (existingUser) {
    throw new HttpError(409, "Ya existe una cuenta registrada con ese correo");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.usuario.create({
      data: {
        nombre: name,
        email,
        passwordHash,
        rolId: role.id,
        consentimientoAceptado: true,
        consentimientoFecha: new Date(),
        consentimientoVersion: DATA_POLICY_VERSION,
        ...(input.role === "JUGADOR"
          ? {
              jugador: {
                create: {
                  codigoUniversitario: input.universityCode.trim(),
                  programa: input.program.trim(),
                  semestre: input.semester,
                },
              },
            }
          : {}),
      },
      include: { rol: true },
    });

    return toUserDto(user);
  } catch (error) {
    // Covers the race between the findUnique above and the create: of two
    // concurrent registrations with the same email, only one can win.
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Ya existe una cuenta registrada con ese correo");
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
export async function loginUser(prisma: PrismaClient, input: LoginUserInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });

  // Same generic message whether the email doesn't exist or the password is
  // wrong: don't reveal whether an account exists (RF02).
  if (!user) {
    throw new HttpError(401, "Credenciales inválidas");
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new HttpError(401, "Credenciales inválidas");
  }

  if (user.estado !== "ACTIVO") {
    throw new HttpError(403, "La cuenta está inactiva");
  }

  return { token: signToken(user), user: toUserDto(user) };
}
