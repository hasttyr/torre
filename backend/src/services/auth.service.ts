import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { HttpError } from "../middlewares/errorHandler";

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

export interface RegisteredUser {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: Date;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function registerUser(
  prisma: PrismaClient,
  input: RegisterUserInput,
): Promise<RegisteredUser> {
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

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      estado: usuario.estado,
      rol: usuario.rol.nombre,
      createdAt: usuario.createdAt,
    };
  } catch (error) {
    // Cubre la carrera entre el findUnique de arriba y el create: dos
    // registros concurrentes con el mismo correo solo pueden ganar uno.
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Ya existe una cuenta registrada con ese correo");
    }
    throw error;
  }
}
