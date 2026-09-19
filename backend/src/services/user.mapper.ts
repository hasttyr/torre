import type { Jugador, Rol, Usuario } from "@prisma/client";

export interface JugadorPerfilDto {
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

// DTO compartido por registro, login y consulta de perfil: nunca incluye
// passwordHash. `jugador` solo está presente si el usuario tiene rol
// JUGADOR (perfil 1:1, ver schema.prisma).
export interface UserDto {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: Date;
  jugador?: JugadorPerfilDto;
}

export function toUserDto(usuario: Usuario & { rol: Rol; jugador?: Jugador | null }): UserDto {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    estado: usuario.estado,
    rol: usuario.rol.nombre,
    createdAt: usuario.createdAt,
    ...(usuario.jugador
      ? {
          jugador: {
            codigoUniversitario: usuario.jugador.codigoUniversitario,
            programa: usuario.jugador.programa,
            semestre: usuario.jugador.semestre,
          },
        }
      : {}),
  };
}
