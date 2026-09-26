import type { Prisma } from "@prisma/client";

// Everything a round's DTO needs, loaded in one query.
export const ROUND_INCLUDE = {
  matches: {
    orderBy: { board: "asc" },
    include: {
      white: { select: { id: true, user: { select: { name: true } } } },
      black: { select: { id: true, user: { select: { name: true } } } },
      result: { select: { value: true } },
    },
  },
} satisfies Prisma.RoundInclude;

export type RoundWithMatches = Prisma.RoundGetPayload<{ include: typeof ROUND_INCLUDE }>;

export interface SeatDto {
  playerId: string;
  name: string;
}

export interface MatchDto {
  id: string;
  board: number;
  status: string;
  white: SeatDto | null;
  black: SeatDto | null;
  // RN-03 catalog value, or null while the game hasn't been recorded.
  result: string | null;
  isBye: boolean;
}

export interface RoundDto {
  id: string;
  number: number;
  status: string;
  createdAt: Date;
  matches: MatchDto[];
}

function toSeat(player: { id: string; user: { name: string } } | null): SeatDto | null {
  return player ? { playerId: player.id, name: player.user.name } : null;
}

/** Maps a round (with its matches) to the public {@link RoundDto} shape. */
export function toRoundDto(round: RoundWithMatches): RoundDto {
  return {
    id: round.id,
    number: round.number,
    status: round.status,
    createdAt: round.createdAt,
    matches: round.matches.map((match) => ({
      id: match.id,
      board: match.board,
      status: match.status,
      white: toSeat(match.white),
      black: toSeat(match.black),
      result: match.result?.value ?? null,
      isBye: !match.whiteId || !match.blackId,
    })),
  };
}
