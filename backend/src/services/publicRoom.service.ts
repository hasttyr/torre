import type { PrismaClient } from "../generated/prisma/client";

import type { StoredResult, TournamentStatus } from "../contracts/catalogs";
import type { PublicRoomDto, PublicTournamentDto } from "../contracts/responses";
import { HttpError } from "../errors/apiErrors";
import { PUBLIC_TOURNAMENT_SELECT } from "./tournaments.service";

// #140: the read-only room anyone can open without a session, to project it
// at the venue or share a link. It puts students' names on the internet, so
// it carries only what is already printed on the venue's wall (names,
// boards, results, standings) and nothing that identifies a person beyond
// that: no ids, no code, program, semester, email, gender or disability.
// The data policy says so (dataPolicy.sections.visibility), and the pages
// are marked noindex (app.ts, frontend/vercel.json).

/**
 * Only a tournament that has published a round has a public room: before
 * that there's nothing to show, and a list of who enrolled isn't a result.
 */
export const PUBLIC_ROOM_STATUSES: TournamentStatus[] = ["IN_PROGRESS", "FINISHED"];

// The listing shows the most recent rooms; older ones stay reachable by link.
const LISTED_ROOMS = 30;

const seat = { select: { user: { select: { name: true } } } } as const;

/** #140: the tournaments being played or already finished, newest first. */
export async function listPublicRooms(prisma: PrismaClient): Promise<PublicTournamentDto[]> {
  return prisma.tournament.findMany({
    where: { status: { in: PUBLIC_ROOM_STATUSES } },
    select: PUBLIC_TOURNAMENT_SELECT,
    orderBy: { startDate: "desc" },
    take: LISTED_ROOMS,
  });
}

/**
 * #140: a tournament's published rounds and standings, for anyone.
 *
 * @throws {HttpError} 404 if it doesn't exist or has no public room yet
 * (the same answer, so a draft's existence isn't revealed).
 */
export async function getPublicRoom(prisma: PrismaClient, tournamentId: string): Promise<PublicRoomDto> {
  const found = await prisma.tournament.findFirst({
    where: { id: tournamentId, status: { in: PUBLIC_ROOM_STATUSES } },
    select: {
      ...PUBLIC_TOURNAMENT_SELECT,
      tiebreakCriteria: { select: { name: true }, orderBy: { order: "asc" } },
    },
  });
  if (!found) {
    throw new HttpError("TOURNAMENT_NOT_FOUND");
  }
  const { tiebreakCriteria, ...tournament } = found;

  const [rounds, standings, withdrawn] = await Promise.all([
    // RN-04: a draft round isn't published, so it isn't here either.
    prisma.round.findMany({
      where: { tournamentId, status: { not: "GENERATED" } },
      orderBy: { number: "asc" },
      select: {
        number: true,
        status: true,
        matches: {
          orderBy: { board: "asc" },
          select: { board: true, white: seat, black: seat, result: { select: { value: true } } },
        },
      },
    }),
    prisma.standing.findMany({
      where: { tournamentId },
      select: {
        rank: true,
        playerId: true,
        score: true,
        buchholz: true,
        buchholzCut1: true,
        sonnebornBerger: true,
        player: { select: { user: { select: { name: true } } } },
      },
      orderBy: [{ rank: "asc" }, { player: { user: { name: "asc" } } }],
    }),
    prisma.enrollment.findMany({
      where: { tournamentId, withdrawnAt: { not: null } },
      select: { playerId: true },
    }),
  ]);
  const withdrawnIds = new Set(withdrawn.map((enrollment) => enrollment.playerId));

  return {
    tournament,
    rounds: rounds.map((round) => ({
      number: round.number,
      status: round.status,
      matches: round.matches.map((match) => ({
        board: match.board,
        white: match.white?.user.name ?? null,
        black: match.black?.user.name ?? null,
        // results.value is text, but its CHECK constraint (RN-03) only lets catalog values in.
        result: (match.result?.value ?? null) as StoredResult | null,
        isBye: !match.white || !match.black,
      })),
    })),
    standings: {
      pending: rounds.some((round) => round.status === "RECORDING_RESULTS"),
      roundsCompleted: rounds.filter((round) => round.status === "STANDINGS_UPDATED").length,
      tiebreaks: tiebreakCriteria.map((criterion) => criterion.name),
      rows: standings.map((row, index) => ({
        rank: row.rank ?? index + 1,
        name: row.player.user.name,
        score: Number(row.score),
        buchholz: Number(row.buchholz),
        buchholzCut1: Number(row.buchholzCut1),
        sonnebornBerger: Number(row.sonnebornBerger),
        withdrawn: withdrawnIds.has(row.playerId),
      })),
    },
  };
}
