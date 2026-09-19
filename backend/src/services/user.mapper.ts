import type { Jugador, Rol, Usuario } from "@prisma/client";

export interface JugadorPerfilDto {
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  fechaNacimiento: Date | null;
  // Calculada a partir de fechaNacimiento, nunca almacenada (evita que se
  // desactualice). null si no hay fecha de nacimiento cargada.
  edad: number | null;
  genero: string | null;
  discapacidad: string | null;
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

export function calcularEdad(fechaNacimiento: Date, hoy: Date = new Date()): number {
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < fechaNacimiento.getMonth() ||
    (hoy.getMonth() === fechaNacimiento.getMonth() && hoy.getDate() < fechaNacimiento.getDate());
  if (aunNoCumple) {
    edad -= 1;
  }
  return edad;
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
            fechaNacimiento: usuario.jugador.fechaNacimiento,
            edad: usuario.jugador.fechaNacimiento ? calcularEdad(usuario.jugador.fechaNacimiento) : null,
            genero: usuario.jugador.genero,
            discapacidad: usuario.jugador.discapacidad,
          },
        }
      : {}),
  };
}
