import type { Prisma, PrismaClient } from "../generated/prisma/client";

import type { AuthUser } from "../types/express";
import type { PlayerSearchResultDto } from "../contracts/responses";

const RESULT_LIMIT = 10;

// A coach names a player by at least a first name and a surname.
const MIN_NAME_WORDS = 2;

/**
 * The players whose name holds every word a coach typed, each as a whole
 * word, whatever the case and accents: "laura perez" finds "Laura Isabel
 * Pérez Gómez", while "lau" or a lone "Laura" finds no one. Accents are
 * folded by Postgres's unaccent (migration 20261022000000_unaccent).
 */
async function playersNamed(prisma: PrismaClient, text: string): Promise<string[]> {
  const words = text.split(/\s+/);
  if (words.length < MIN_NAME_WORDS) {
    return [];
  }
  const players = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM players p JOIN users u ON u.id = p.user_id
    WHERE regexp_split_to_array(lower(unaccent(u.name)), '[[:space:]]+')
      @> ARRAY(SELECT lower(unaccent(word)) FROM unnest(${words}::text[]) AS word)`;
  return players.map(({ id }) => id);
}

/**
 * Who a search finds. Whoever runs tournaments and clubs looks people up by
 * any part of a name, email or university code. A coach, a role anyone can
 * sign up for, needs a name given as first name and surname (playersNamed),
 * or the whole address or code, so the directory can't be swept by fragments.
 */
async function matching(prisma: PrismaClient, text: string, viewer: AuthUser): Promise<Prisma.PlayerWhereInput[]> {
  if (viewer.role !== "COACH") {
    const fragment = { contains: text, mode: "insensitive" } as const;
    return [{ user: { name: fragment } }, { user: { email: fragment } }, { universityCode: fragment }];
  }
  const whole = { equals: text, mode: "insensitive" } as const;
  return [{ id: { in: await playersNamed(prisma, text) } }, { user: { email: whole } }, { universityCode: whole }];
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
      OR: await matching(prisma, text, viewer),
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
