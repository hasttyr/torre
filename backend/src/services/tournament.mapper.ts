import type { CriterioDesempate, Torneo } from "@prisma/client";

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
  organizerId: string;
  tiebreakCriteria: { name: string; order: number }[];
  createdAt: Date;
}

/** Maps a Prisma tournament (with its tiebreak criteria) to the public {@link TournamentDto} shape. */
export function toTournamentDto(tournament: Torneo & { criteriosDesempate?: CriterioDesempate[] }): TournamentDto {
  return {
    id: tournament.id,
    name: tournament.nombre,
    startDate: tournament.fechaInicio,
    endDate: tournament.fechaFin,
    status: tournament.estado,
    format: tournament.formato,
    roundsCount: tournament.numeroRondas,
    timeControl: tournament.ritmo,
    restrictedProgram: tournament.programaRestringido,
    minimumSemester: tournament.semestreMinimo,
    organizerId: tournament.organizadorId,
    tiebreakCriteria: (tournament.criteriosDesempate ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((criterion) => ({ name: criterion.nombre, order: criterion.orden })),
    createdAt: tournament.createdAt,
  };
}
