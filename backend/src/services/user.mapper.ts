import type { Jugador, Rol, Usuario } from "@prisma/client";

export interface PlayerProfileDto {
  universityCode: string;
  program: string;
  semester: number;
  birthDate: Date | null;
  // Computed from birthDate, never stored (avoids it going stale).
  // null if no birth date is on file.
  age: number | null;
  gender: string | null;
  disability: string | null;
}

// DTO shared by registration, login and profile lookup: never includes
// passwordHash. `player` is only present if the user has the JUGADOR role
// (1:1 profile, see schema.prisma).
export interface UserDto {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  createdAt: Date;
  player?: PlayerProfileDto;
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
    name: user.nombre,
    email: user.email,
    status: user.estado,
    role: user.rol.nombre,
    createdAt: user.createdAt,
    ...(user.jugador
      ? {
          player: {
            universityCode: user.jugador.codigoUniversitario,
            program: user.jugador.programa,
            semester: user.jugador.semestre,
            birthDate: user.jugador.fechaNacimiento,
            age: user.jugador.fechaNacimiento ? calculateAge(user.jugador.fechaNacimiento) : null,
            gender: user.jugador.genero,
            disability: user.jugador.discapacidad,
          },
        }
      : {}),
  };
}
