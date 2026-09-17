import type { PrismaClient } from "@prisma/client";

export interface JugadorBusquedaDto {
  id: string;
  nombre: string;
  email: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

const LIMITE_RESULTADOS = 10;

// Apoya a HU07 en la UI: sin esto, el organizador no tiene forma de saber
// el id de Jugador (distinto del id de Usuario) que exige POST
// /torneos/:id/jugadores. Búsqueda simple por nombre, correo o código
// universitario; no hay catálogo de permisos adicional más allá de
// requireRole en la ruta, porque no expone datos que el organizador no
// pueda ya ver en la inscripción resultante.
export async function buscarJugadores(prisma: PrismaClient, query: string): Promise<JugadorBusquedaDto[]> {
  const texto = query.trim();
  if (!texto) {
    return [];
  }

  const jugadores = await prisma.jugador.findMany({
    where: {
      OR: [
        { usuario: { nombre: { contains: texto, mode: "insensitive" } } },
        { usuario: { email: { contains: texto, mode: "insensitive" } } },
        { codigoUniversitario: { contains: texto, mode: "insensitive" } },
      ],
    },
    include: { usuario: true },
    take: LIMITE_RESULTADOS,
    orderBy: { usuario: { nombre: "asc" } },
  });

  return jugadores.map((jugador) => ({
    id: jugador.id,
    nombre: jugador.usuario.nombre,
    email: jugador.usuario.email,
    codigoUniversitario: jugador.codigoUniversitario,
    programa: jugador.programa,
    semestre: jugador.semestre,
  }));
}
