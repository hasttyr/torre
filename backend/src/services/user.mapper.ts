import type { Rol, Usuario } from "@prisma/client";

// DTO compartido por registro, login y consulta de perfil: nunca incluye
// passwordHash.
export interface UserDto {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: Date;
}

export function toUserDto(usuario: Usuario & { rol: Rol }): UserDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    estado: usuario.estado,
    rol: usuario.rol.nombre,
    createdAt: usuario.createdAt,
  };
}
