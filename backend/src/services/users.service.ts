import type { Prisma, PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import type { UpdateProfileSchemaInput } from "../validators/users.schemas";
import { toUserDto, type UserDto } from "./user.mapper";

const CAMPOS_JUGADOR = [
  "codigoUniversitario",
  "programa",
  "semestre",
  "fechaNacimiento",
  "genero",
  "discapacidad",
] as const;

function tieneCambiosJugador(data: UpdateProfileSchemaInput): boolean {
  return CAMPOS_JUGADOR.some((campo) => data[campo] !== undefined);
}

function construirDatosJugador(data: UpdateProfileSchemaInput): Prisma.JugadorUpdateWithoutUsuarioInput {
  return {
    ...(data.codigoUniversitario !== undefined ? { codigoUniversitario: data.codigoUniversitario.trim() } : {}),
    ...(data.programa !== undefined ? { programa: data.programa.trim() } : {}),
    ...(data.semestre !== undefined ? { semestre: data.semestre } : {}),
    ...(data.fechaNacimiento !== undefined ? { fechaNacimiento: data.fechaNacimiento } : {}),
    ...(data.genero !== undefined ? { genero: data.genero } : {}),
    ...(data.discapacidad !== undefined ? { discapacidad: data.discapacidad } : {}),
  };
}

export async function getUserById(prisma: PrismaClient, id: string): Promise<UserDto> {
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: true, jugador: true } });
  if (!usuario) {
    throw new HttpError(404, "Usuario no encontrado");
  }
  return toUserDto(usuario);
}

export async function updateUserRole(prisma: PrismaClient, id: string, nuevoRol: string): Promise<UserDto> {
  const rol = await prisma.rol.findUnique({ where: { nombre: nuevoRol } });
  if (!rol) {
    throw new HttpError(400, `El rol "${nuevoRol}" no existe`);
  }

  const existente = await prisma.usuario.findUnique({ where: { id } });
  if (!existente) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: { rolId: rol.id },
    include: { rol: true, jugador: true },
  });

  // RN-11 exige registrar este cambio en la bitácora de auditoría; la
  // entidad Bitacora todavía no existe (llega en S13, incremento 9 del
  // roadmap). Cuando exista, este es el punto donde se escribe el registro.
  return toUserDto(usuario);
}

// HU20: el usuario solo edita SU propio perfil (el :id nunca viene del
// body, siempre de req.user.id en el controller) y nunca su rol — el
// payload de esta función ni siquiera acepta ese campo (ver
// validators/users.schemas.ts). Los campos de Jugador solo se actualizan
// si el usuario tiene ese perfil.
export async function updateOwnProfile(
  prisma: PrismaClient,
  userId: string,
  data: UpdateProfileSchemaInput,
): Promise<UserDto> {
  const existente = await prisma.usuario.findUnique({ where: { id: userId }, include: { jugador: true } });
  if (!existente) {
    throw new HttpError(404, "Usuario no encontrado");
  }

  const hayCambiosJugador = tieneCambiosJugador(data);
  if (hayCambiosJugador && !existente.jugador) {
    throw new HttpError(400, "Este usuario no tiene un perfil de jugador para actualizar");
  }

  const usuario = await prisma.usuario.update({
    where: { id: userId },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
      ...(hayCambiosJugador ? { jugador: { update: construirDatosJugador(data) } } : {}),
    },
    include: { rol: true, jugador: true },
  });

  return toUserDto(usuario);
}
