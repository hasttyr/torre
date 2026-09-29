import type { TiebreakCriterion, Tournament } from "../generated/prisma/client";
import type { TournamentDto } from "../contracts/responses";

/** Maps a Prisma tournament (with its tiebreak criteria) to the public {@link TournamentDto} shape. */
export function toTournamentDto(tournament: Tournament & { tiebreakCriteria?: TiebreakCriterion[] }): TournamentDto {
  return {
    id: tournament.id,
    name: tournament.name,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    status: tournament.status,
    format: tournament.format,
    roundsCount: tournament.roundsCount,
    timeControl: tournament.timeControl,
    restrictedProgram: tournament.restrictedProgram,
    minimumSemester: tournament.minimumSemester,
    byePoints: Number(tournament.byePoints),
    organizerId: tournament.organizerId,
    tiebreakCriteria: (tournament.tiebreakCriteria ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((criterion) => ({ name: criterion.name, order: criterion.order })),
    createdAt: tournament.createdAt,
  };
}

export type { TournamentDto };
