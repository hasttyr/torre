import type { PrismaClient } from "@prisma/client";

export interface PlayerSearchResultDto {
  id: string;
  nombre: string;
  email: string;
  codigoUniversitario: string;
  programa: string;
  semestre: number;
}

const RESULT_LIMIT = 10;

// Supports HU07 in the UI: without this, the organizer has no way to learn
// the Jugador id (different from the Usuario id) that POST
// /torneos/:id/jugadores requires. Simple search by name, email or
// university code; there's no additional permission catalog beyond
// requireRole on the route, because it doesn't expose data the organizer
// couldn't already see in the resulting enrollment.
/** Searches players by name, email or university code. */
export async function searchPlayers(prisma: PrismaClient, query: string): Promise<PlayerSearchResultDto[]> {
  const text = query.trim();
  if (!text) {
    return [];
  }

  const players = await prisma.jugador.findMany({
    where: {
      OR: [
        { usuario: { nombre: { contains: text, mode: "insensitive" } } },
        { usuario: { email: { contains: text, mode: "insensitive" } } },
        { codigoUniversitario: { contains: text, mode: "insensitive" } },
      ],
    },
    include: { usuario: true },
    take: RESULT_LIMIT,
    orderBy: { usuario: { nombre: "asc" } },
  });

  return players.map((player) => ({
    id: player.id,
    nombre: player.usuario.nombre,
    email: player.usuario.email,
    codigoUniversitario: player.codigoUniversitario,
    programa: player.programa,
    semestre: player.semestre,
  }));
}
