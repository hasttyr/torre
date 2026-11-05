import type { Club, Player, Role, User } from "../generated/prisma/client";
import { todayInBogota } from "./bogotaCalendar";
import type {
  DataConsentDto,
  PlayerClubDto,
  PlayerDetailsDto,
  PlayerProfileDto,
  UserDto,
} from "../contracts/responses";

/** What identifies a player at the university, beyond their name. */
export function playerDetails(player: PlayerDetailsDto): PlayerDetailsDto {
  return { universityCode: player.universityCode, program: player.program, semester: player.semester };
}

/**
 * Computes age in whole years from a birth date, as of `today` (Colombia's
 * calendar day by default). Both are calendar days stored at UTC midnight,
 * so both are read in UTC: in the server's zone the birthday came a day early.
 */
export function calculateAge(birthDate: Date, today: Date = todayInBogota()): number {
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const hasNotHadBirthdayYet =
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate());
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
