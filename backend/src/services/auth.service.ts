import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { HttpError } from "../middlewares/errorHandler";
import { toUserDto, type UserDto } from "./user.mapper";

const SALT_ROUNDS = 10;

interface RegisterUserBase {
  nombre: string;
  email: string;
  password: string;
}

interface RegisterJugadorInput extends RegisterUserBase {
  rol: "JUGADOR";
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

interface RegisterOtroRolInput extends RegisterUserBase {
  rol: "ORGANIZADOR" | "ARBITRO" | "ENTRENADOR";
}

export type RegisterUserInput = RegisterJugadorInput | RegisterOtroRolInput;

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  usuario: UserDto;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

function signToken(usuario: { id: string; rol: { nombre: string } }): string {
  // El rol viaja embebido en el token (no se relee de la BD en cada
  // request): si un admin cambia el rol de alguien, esa persona lo ve
  // reflejado recién en su próximo login, no de inmediato. Trade-off
  // estándar de JWT sin estado, aceptable con expiración corta (1d).
  return jwt.sign({ sub: usuario.id, rol: usuario.rol.nombre }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export async function registerUser(prisma: PrismaClient, input: RegisterUserInput): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();
  const nombre = input.nombre.trim();

  const rol = await prisma.rol.findUnique({ where: { nombre: input.rol } });
  if (!rol) {
    throw new HttpError(400, `El rol "${input.rol}" no existe. Verificá que el seed de roles se haya ejecutado.`);
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    throw new HttpError(409, "Ya existe una cuenta registrada con ese correo");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        rolId: rol.id,
        ...(input.rol === "JUGADOR"
          ? {
              jugador: {
                create: {
                  codigoUniversitario: input.codigoUniversitario.trim(),
                  programa: input.programa.trim(),
                  semestre: input.semestre,
                },
              },
            }
          : {}),
      },
      include: { rol: true },
    });

    return toUserDto(usuario);
  } catch (error) {
    // Cubre la carrera entre el findUnique de arriba y el create: dos
    // registros concurrentes con el mismo correo solo pueden ganar uno.
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Ya existe una cuenta registrada con ese correo");
    }
    throw error;
  }
}

export async function loginUser(prisma: PrismaClient, input: LoginUserInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true } });

  // Mismo mensaje genérico si el correo no existe o la contraseña es
  // incorrecta: no revelar si una cuenta existe (RF02).
  if (!usuario) {
    throw new HttpError(401, "Credenciales inválidas");
  }

  const passwordValida = await bcrypt.compare(input.password, usuario.passwordHash);
  if (!passwordValida) {
    throw new HttpError(401, "Credenciales inválidas");
  }

  if (usuario.estado !== "ACTIVO") {
    throw new HttpError(403, "La cuenta está inactiva");
  }

  return { token: signToken(usuario), usuario: toUserDto(usuario) };
}
