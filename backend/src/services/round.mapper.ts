import type { Prisma } from "../generated/prisma/client";
import type { StoredResult } from "../contracts/catalogs";
import type { MatchDto, RoundDto, SeatDto } from "../contracts/responses";

// Everything a round's DTO needs, loaded in one query.
export const ROUND_INCLUDE = {
  matches: {
    orderBy: { board: "asc" },
    include: {
      white: { select: { id: true, userId: true, user: { select: { name: true } } } },
      black: { select: { id: true, userId: true, user: { select: { name: true } } } },
      result: { select: { value: true } },
    },
  },
} satisfies Prisma.RoundInclude;

export type RoundWithMatches = Prisma.RoundGetPayload<{ include: typeof ROUND_INCLUDE }>;

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
      // results.value is text, but its CHECK constraint (RN-03) only lets these values in.
      result: (match.result?.value ?? null) as StoredResult | null,
      isBye: !match.whiteId || !match.blackId,
    })),
  };
}

export type { MatchDto, RoundDto, SeatDto };
