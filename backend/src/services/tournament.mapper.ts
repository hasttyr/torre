import type { CriterioDesempate, Torneo } from "@prisma/client";

export interface TournamentDto {
  id: string;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  formato: string;
  numeroRondas: number | null;
  ritmo: string | null;
  programaRestringido: string | null;
  semestreMinimo: number | null;
  organizadorId: string;
  criteriosDesempate: { nombre: string; orden: number }[];
  createdAt: Date;
}

/** Maps a Prisma tournament (with its tiebreak criteria) to the public {@link TournamentDto} shape. */
export function toTournamentDto(tournament: Torneo & { criteriosDesempate?: CriterioDesempate[] }): TournamentDto {
  return {
    id: tournament.id,
    nombre: tournament.nombre,
    fechaInicio: tournament.fechaInicio,
    fechaFin: tournament.fechaFin,
    estado: tournament.estado,
    formato: tournament.formato,
    numeroRondas: tournament.numeroRondas,
    ritmo: tournament.ritmo,
    programaRestringido: tournament.programaRestringido,
    semestreMinimo: tournament.semestreMinimo,
    organizadorId: tournament.organizadorId,
    criteriosDesempate: (tournament.criteriosDesempate ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((criterion) => ({ nombre: criterion.nombre, orden: criterion.orden })),
    createdAt: tournament.createdAt,
  };
}
