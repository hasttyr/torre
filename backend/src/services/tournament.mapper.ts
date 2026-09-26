import type { TiebreakCriterion, Tournament } from "@prisma/client";

export interface TournamentDto {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  format: string;
  roundsCount: number | null;
  timeControl: string | null;
  restrictedProgram: string | null;
  minimumSemester: number | null;
  byePoints: number;
  organizerId: string;
  tiebreakCriteria: { name: string; order: number }[];
  createdAt: Date;
}

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
