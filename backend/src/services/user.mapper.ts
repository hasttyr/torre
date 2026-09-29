import type { Club, Player, Role, User } from "../generated/prisma/client";
import type { DataConsentDto, PlayerClubDto, PlayerProfileDto, UserDto } from "../contracts/responses";

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

export type { DataConsentDto, PlayerClubDto, PlayerProfileDto, UserDto };
