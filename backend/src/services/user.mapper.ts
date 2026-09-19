import type { Jugador, Rol, Usuario } from "@prisma/client";

export interface JugadorPerfilDto {
  codigoUniversitario: string;
  programa: string;
  semestre: number;
  fechaNacimiento: Date | null;
  // Computed from fechaNacimiento, never stored (avoids it going stale).
  // null if no birth date is on file.
  edad: number | null;
  genero: string | null;
  discapacidad: string | null;
}

// DTO shared by registration, login and profile lookup: never includes
// passwordHash. `jugador` is only present if the user has the JUGADOR role
// (1:1 profile, see schema.prisma).
export interface UserDto {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  rol: string;
  createdAt: Date;
  jugador?: JugadorPerfilDto;
}

/** Computes age in whole years from a birth date, as of `today`. */
export function calculateAge(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotHadBirthdayYet =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (hasNotHadBirthdayYet) {
    age -= 1;
  }
  return age;
}

/** Maps a Prisma user (with its role and optional player profile) to the public {@link UserDto} shape. */
export function toUserDto(user: Usuario & { rol: Rol; jugador?: Jugador | null }): UserDto {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    estado: user.estado,
    rol: user.rol.nombre,
    createdAt: user.createdAt,
    ...(user.jugador
      ? {
          jugador: {
            codigoUniversitario: user.jugador.codigoUniversitario,
            programa: user.jugador.programa,
            semestre: user.jugador.semestre,
            fechaNacimiento: user.jugador.fechaNacimiento,
            edad: user.jugador.fechaNacimiento ? calculateAge(user.jugador.fechaNacimiento) : null,
            genero: user.jugador.genero,
            discapacidad: user.jugador.discapacidad,
          },
        }
      : {}),
  };
}
