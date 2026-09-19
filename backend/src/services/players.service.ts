import type { PrismaClient } from "@prisma/client";

export interface PlayerSearchResultDto {
  id: string;
  name: string;
  email: string;
  universityCode: string;
  program: string;
  semester: number;
}

const RESULT_LIMIT = 10;

// Supports HU07 in the UI: without this, the organizer has no way to learn
// the Player id (different from the User id) that POST
// /tournaments/:id/players requires. Simple search by name, email or
// university code; there's no additional permission catalog beyond
// requireRole on the route, because it doesn't expose data the organizer
// couldn't already see in the resulting enrollment.
/** Searches players by name, email or university code. */
export async function searchPlayers(prisma: PrismaClient, query: string): Promise<PlayerSearchResultDto[]> {
  const text = query.trim();
  if (!text) {
    return [];
  }

  const players = await prisma.player.findMany({
    where: {
      OR: [
        { user: { name: { contains: text, mode: "insensitive" } } },
        { user: { email: { contains: text, mode: "insensitive" } } },
        { universityCode: { contains: text, mode: "insensitive" } },
      ],
    },
    include: { user: true },
    take: RESULT_LIMIT,
    orderBy: { user: { name: "asc" } },
  });

  return players.map((player) => ({
    id: player.id,
    name: player.user.name,
    email: player.user.email,
    universityCode: player.universityCode,
    program: player.program,
    semester: player.semester,
  }));
}
