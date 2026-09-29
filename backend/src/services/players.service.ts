import type { Prisma, PrismaClient } from "../generated/prisma/client";

import type { AuthUser } from "../types/express";
import type { PlayerSearchResultDto } from "../contracts/responses";

const RESULT_LIMIT = 10;

/**
 * How a search term matches an email. Whoever runs tournaments and clubs
 * looks people up by any part of it; a coach, who only follows players,
 * needs the whole address, so the directory can't be swept by domain.
 */
function emailMatch(viewer: AuthUser, text: string): Prisma.StringFilter<"User"> {
  return viewer.role === "COACH" ? { equals: text, mode: "insensitive" } : { contains: text, mode: "insensitive" };
}

// Supports HU07 in the UI: without this, the organizer has no way to learn
// the Player id (different from the User id) that POST
// /tournaments/:id/players requires. Simple search by name, email or
// university code, gated by role on the route. The email is a search key
// only: no screen needs it, so results never carry it (Ley 1581 art. 4,
// data minimization).
/** Searches active players by name, email or university code. */
export async function searchPlayers(
  prisma: PrismaClient,
  query: string,
  viewer: AuthUser,
): Promise<PlayerSearchResultDto[]> {
  const text = query.trim();
  if (!text) {
    return [];
  }

  const players = await prisma.player.findMany({
    where: {
      // A blocked or suppressed account ("Usuario eliminado") can't be
      // enrolled, linked to a coach or put in a club.
      user: { status: "ACTIVE" },
      OR: [
        { user: { name: { contains: text, mode: "insensitive" } } },
        { user: { email: emailMatch(viewer, text) } },
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
    universityCode: player.universityCode,
    program: player.program,
    semester: player.semester,
  }));
}

export type { PlayerSearchResultDto };
