import type { Prisma, PrismaClient } from "../generated/prisma/client";

import type { AuthUser } from "../types/express";
import type { DataRequestSchemaInput } from "../validators/users.schemas";
import { REVOKE_SESSIONS } from "./sessionToken";
import { toUserDto, type UserDto } from "./user.mapper";
import { assertAnotherAdministratorRemains, getUserById, updateOwnProfile } from "./users.service";
import type { DataRightResult, PersonalDataExport } from "../contracts/responses";

type Db = Prisma.TransactionClient;

// Tournament states in which the data of those taking part is still needed
// to run the competition (CA HU22: suppression is blocked, not denied, while
// this holds).
const ACTIVE_TOURNAMENT_STATUSES = ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "IN_PROGRESS"] as const;

/**
 * Whether the user's data is still indispensable to a running tournament:
 * they play in one (as an enrolled player) or run one (as its organizer).
 */
async function isNeededByActiveTournament(db: Db, userId: string): Promise<boolean> {
  const active = { status: { in: [...ACTIVE_TOURNAMENT_STATUSES] } };
  const [playing, organizing] = await Promise.all([
    db.enrollment.count({ where: { player: { userId }, tournament: active } }),
    db.tournament.count({ where: { organizerId: userId, ...active } }),
  ]);
  return playing + organizing > 0;
}

/**
 * Suppresses (anonymizes) an account for good, inside the caller's transaction.
 *
 * @remarks
 * Anonymized instead of deleted: other tables (Tournament.organizerId,
 * historic Enrollment/Standing rows) reference this user, and past results
 * must stay readable. Every personal field goes, above all the sensitive ones
 * (disability, gender, birth date: Ley 1581 art. 5), along with whatever
 * links the person to others (coaches, club) or still works as a credential.
 * The audit trail mentions people by id, so it reads "Usuario eliminado" from
 * now on without being rewritten.
 */
async function suppressAccount(db: Db, userId: string): Promise<UserDto> {
  const player = await db.player.findUnique({ where: { userId }, select: { id: true } });
  await db.coachPlayer.deleteMany({
    where: { OR: [{ coachId: userId }, ...(player ? [{ playerId: player.id }] : [])] },
  });
  await db.passwordResetRequest.deleteMany({ where: { userId } });
  // What the person wrote in earlier requests is theirs too.
  await db.dataRequest.updateMany({ where: { userId }, data: { detail: null } });

  const user = await db.user.update({
    where: { id: userId },
    data: {
      name: "Usuario eliminado",
      email: `eliminado-${userId}@torre.invalid`,
      status: "INACTIVE",
      // Not a hash of anything: no password can match it again.
      passwordHash: "!suppressed",
      suppressedAt: new Date(),
      ...REVOKE_SESSIONS,
      ...(player
        ? {
            player: {
              update: {
                universityCode: "—",
                program: "—",
                birthDate: null,
                gender: null,
                disability: null,
                clubId: null,
              },
            },
          }
        : {}),
    },
    include: { role: true, player: true },
  });
  return toUserDto(user);
}

/** Blocks (deactivates) an account whose data a running tournament still needs; see {@link completeBlockedSuppressions}. */
async function blockAccount(db: Db, userId: string): Promise<UserDto> {
  const user = await db.user.update({
    where: { id: userId },
    data: { status: "INACTIVE", ...REVOKE_SESSIONS },
    include: { role: true, player: true },
  });
  return toUserDto(user);
}

/**
 * Carries out the suppressions that were blocked by a tournament (CA HU22)
 * once it's over, for everyone it no longer holds: call it in the same
 * transaction that finishes the tournament.
 */
export async function completeBlockedSuppressions(db: Db, tournamentId: string): Promise<void> {
  const pending = await db.dataRequest.findMany({
    where: {
      type: "SUPPRESSION",
      status: "BLOCKED",
      user: {
        OR: [
          { player: { enrollments: { some: { tournamentId } } } },
          { organizedTournaments: { some: { id: tournamentId } } },
        ],
      },
    },
    select: { userId: true },
  });

  for (const userId of new Set(pending.map((request) => request.userId))) {
    if (await isNeededByActiveTournament(db, userId)) continue;
    await suppressAccount(db, userId);
    await db.dataRequest.updateMany({
      where: { userId, type: "SUPPRESSION", status: "BLOCKED" },
      data: { status: "RESOLVED" },
    });
  }
}

type PlayerHistory = Pick<PersonalDataExport, "coaches" | "tournaments" | "games">;

/** A player's side of the export: who coaches them, where they played and every published game. */
async function playerHistory(prisma: PrismaClient, playerId: string): Promise<PlayerHistory> {
  const [coachLinks, enrollments, standings, matches] = await Promise.all([
    prisma.coachPlayer.findMany({
      where: { playerId },
      include: { coach: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.enrollment.findMany({ where: { playerId }, include: { tournament: true }, orderBy: { createdAt: "asc" } }),
    prisma.standing.findMany({ where: { playerId } }),
    prisma.match.findMany({
      // Published rounds only: a draft isn't information about the person yet.
      where: { OR: [{ whiteId: playerId }, { blackId: playerId }], round: { status: { not: "GENERATED" } } },
      include: {
        round: { select: { number: true, tournament: { select: { name: true } } } },
        white: { select: { user: { select: { name: true } } } },
        black: { select: { user: { select: { name: true } } } },
        result: { select: { value: true } },
      },
      orderBy: [{ round: { tournament: { startDate: "asc" } } }, { round: { number: "asc" } }],
    }),
  ]);
  const standingByTournament = new Map(standings.map((standing) => [standing.tournamentId, standing]));

  return {
    coaches: coachLinks.map((link) => ({
      name: link.coach.name,
      linkedAt: link.createdAt,
      acceptedAt: link.acceptedAt,
    })),
    tournaments: enrollments.map((enrollment) => {
      const standing = standingByTournament.get(enrollment.tournamentId);
      const { id, name, startDate, endDate, status } = enrollment.tournament;
      return {
        tournament: { id, name, startDate, endDate, status },
        enrolledAt: enrollment.createdAt,
        withdrawnAt: enrollment.withdrawnAt,
        pairingNumber: enrollment.pairingNumber,
        standing: standing ? { rank: standing.rank, score: Number(standing.score) } : null,
      };
    }),
    games: matches.map((match) => {
      const isWhite = match.whiteId === playerId;
      const opponent = isWhite ? match.black : match.white;
      return {
        tournament: match.round.tournament.name,
        round: match.round.number,
        board: match.board,
        color: isWhite ? "WHITE" : "BLACK",
        opponent: opponent?.user.name ?? null,
        result: match.result?.value ?? null,
      };
    }),
  };
}

const NO_PLAYER_HISTORY: PlayerHistory = { coaches: [], tournaments: [], games: [] };

/** Everything the system holds about a person (Ley 1581 art. 8: the right to know), in one document. */
async function exportPersonalData(prisma: PrismaClient, userId: string): Promise<PersonalDataExport> {
  const profile = await getUserById(prisma, userId);
  const player = await prisma.player.findUnique({ where: { userId }, select: { id: true } });
  const [history, dataRequests, auditedActions] = await Promise.all([
    player ? playerHistory(prisma, player.id) : NO_PLAYER_HISTORY,
    prisma.dataRequest.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    profile,
    ...history,
    // What the person asked for, not what they wrote (the reason isn't kept).
    dataRequests: dataRequests.map(({ type, status, createdAt }) => ({ type, status, createdAt })),
    // The critical actions they performed; the detail names other people.
    auditedActions: auditedActions.map(({ action, createdAt }) => ({ action, createdAt })),
  };
}

/**
 * Exercises a data-subject right (access, rectification or suppression) for
 * the given user (HU22, Ley 1581 de 2012 art. 8). Every exercised right is
 * recorded in `data_requests` for traceability, regardless of outcome, in the
 * same transaction as its effect.
 *
 * @throws {HttpError} 404 if the user doesn't exist, 409 if suppressing the
 * last active administrator.
 */
export async function exerciseDataRight(
  prisma: PrismaClient,
  request: DataRequestSchemaInput,
  actor: AuthUser,
): Promise<DataRightResult> {
  const userId = actor.id;
  if (request.type === "ACCESS") {
    const data = await exportPersonalData(prisma, userId);
    await prisma.dataRequest.create({ data: { userId, type: "ACCESS", status: "RESOLVED" } });
    return { type: "ACCESS", status: "RESOLVED", message: "Solicitud de acceso atendida", user: data.profile, data };
  }

  if (request.type === "RECTIFICATION") {
    const user = await updateOwnProfile(prisma, request.data, actor);
    await prisma.dataRequest.create({ data: { userId, type: "RECTIFICATION", status: "RESOLVED" } });
    return { type: "RECTIFICATION", status: "RESOLVED", message: "Datos actualizados correctamente", user };
  }

  return prisma.$transaction(async (tx) => {
    await assertAnotherAdministratorRemains(tx, userId);
    if (await isNeededByActiveTournament(tx, userId)) {
      const user = await blockAccount(tx, userId);
      // The reason is kept only while the request is pending.
      await tx.dataRequest.create({
        data: { userId, type: "SUPPRESSION", status: "BLOCKED", detail: request.reason },
      });
      return {
        type: "SUPPRESSION" as const,
        status: "BLOCKED" as const,
        message: "La cuenta se bloqueó temporalmente: hay datos indispensables para un torneo en curso",
        user,
      };
    }

    const user = await suppressAccount(tx, userId);
    await tx.dataRequest.create({ data: { userId, type: "SUPPRESSION", status: "RESOLVED" } });
    return {
      type: "SUPPRESSION" as const,
      status: "RESOLVED" as const,
      message: "Los datos personales fueron suprimidos",
      user,
    };
  });
}

export type { DataRightResult, PersonalDataExport };
