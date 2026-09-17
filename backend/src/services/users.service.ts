import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import { toUserDto, type UserDto } from "./user.mapper";

export async function getUserById(prisma: PrismaClient, id: string): Promise<UserDto> {
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
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
    include: { rol: true },
  });

  // RN-11 exige registrar este cambio en la bitácora de auditoría; la
  // entidad Bitacora todavía no existe (llega en S13, incremento 9 del
  // roadmap). Cuando exista, este es el punto donde se escribe el registro.
  return toUserDto(usuario);
}
