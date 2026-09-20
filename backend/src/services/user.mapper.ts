import type { Club, Player, Role, User } from "@prisma/client";

export interface PlayerClubDto {
  id: string;
  name: string;
}

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
  // HU23: null when the player isn't currently in a club.
  club: PlayerClubDto | null;
}

// HU22 ("access"): exposed on the profile so the data subject can see, without
// requesting it separately, when and under which policy version they
// accepted the data-treatment terms (RN-10/HU21).
export interface DataConsentDto {
  accepted: boolean;
  date: Date | null;
  version: string | null;
}

// DTO shared by registration, login and profile lookup: never includes
// passwordHash. `player` is only present if the user has the PLAYER role
// (1:1 profile, see schema.prisma).
export interface UserDto {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  createdAt: Date;
  dataConsent: DataConsentDto;
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
export function toUserDto(user: User & { role: Role; player?: (Player & { club?: Club | null }) | null }): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: user.role.name,
    createdAt: user.createdAt,
    dataConsent: {
      accepted: user.dataPolicyAccepted,
      date: user.dataPolicyAcceptedAt,
      version: user.dataPolicyVersion,
    },
    ...(user.player
      ? {
          player: {
            universityCode: user.player.universityCode,
            program: user.player.program,
            semester: user.player.semester,
            birthDate: user.player.birthDate,
            age: user.player.birthDate ? calculateAge(user.player.birthDate) : null,
            gender: user.player.gender,
            disability: user.player.disability,
            club: user.player.club ? { id: user.player.club.id, name: user.player.club.name } : null,
          },
        }
      : {}),
  };
}
