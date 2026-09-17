import type { CriterioDesempate, Torneo } from "@prisma/client";

export interface TorneoDto {
  id: string;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: string;
  formato: string;
  numeroRondas: number | null;
  ritmo: string | null;
  organizadorId: string;
  criteriosDesempate: { nombre: string; orden: number }[];
  createdAt: Date;
}

export function toTorneoDto(torneo: Torneo & { criteriosDesempate?: CriterioDesempate[] }): TorneoDto {
  return {
    id: torneo.id,
    nombre: torneo.nombre,
    fechaInicio: torneo.fechaInicio,
    fechaFin: torneo.fechaFin,
    estado: torneo.estado,
    formato: torneo.formato,
    numeroRondas: torneo.numeroRondas,
    ritmo: torneo.ritmo,
    organizadorId: torneo.organizadorId,
    criteriosDesempate: (torneo.criteriosDesempate ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((criterio) => ({ nombre: criterio.nombre, orden: criterio.orden })),
    createdAt: torneo.createdAt,
  };
}
