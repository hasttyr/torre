import type { PrismaClient } from "../generated/prisma/client";
import { parseLegacyDetail, withMentions, type LegacyDetail } from "./legacyAuditDetails";
import { runCommand } from "./runCommand";

// One-off (HU22): audit entries written before details referenced people by
// id still hold their names as text, which a suppression can't reach. This
// replaces each name that belongs to exactly one person with a reference to
// them, so the log reads the same until that person's data is suppressed.
// Anything else stays as it is and is listed, for a person to decide:
//
//   npm run build
//   npm run audit:link-names               # dry run: says what it would do
//   npm run audit:link-names -- --apply    # does it, in one transaction

export interface MigrationReport {
  /** Entries whose names were replaced (on a dry run, would be). */
  linked: number;
  /** Entries left as they are, and why. */
  left: { id: string; action: string; detail: string; reason: string }[];
}

type Resolution = { userIds: string[] } | { reason: string };

/** The two players of the game a corrected result names: by its place, whatever they're called now. */
async function playersOfGame(prisma: PrismaClient, { tournament, round, board }: LegacyDetail): Promise<Resolution> {
  const games = await prisma.match.findMany({
    where: { board, round: { number: round, tournament: { name: tournament } } },
    select: { white: { select: { userId: true } }, black: { select: { userId: true } } },
    take: 2,
  });
  const [game] = games;
  if (games.length !== 1 || !game?.white || !game.black) {
    return { reason: `no single game at "${tournament}", ronda ${round}, mesa ${board}` };
  }
  return { userIds: [game.white.userId, game.black.userId] };
}

/** Each named person, when exactly one has that name (among the tournament's players, if the entry names one). */
async function peopleNamed(prisma: PrismaClient, { names, tournament }: LegacyDetail): Promise<Resolution> {
  const among = tournament === undefined ? "" : ` among the players of "${tournament}"`;
  const userIds: string[] = [];
  for (const { name } of names) {
    const people = await prisma.user.findMany({
      where: {
        name,
        ...(tournament === undefined
          ? {}
          : { player: { enrollments: { some: { tournament: { name: tournament } } } } }),
      },
      select: { id: true },
      take: 2,
    });
    if (people.length === 0) return { reason: `nobody is called "${name}"${among} now` };
    if (people.length > 1) return { reason: `more than one person is called "${name}"${among}` };
    userIds.push(people[0]!.id);
  }
  return { userIds };
}

/** Links the names in old audit entries to their people; with `apply: false`, only reports. */
export async function migrateLegacyAuditDetails(
  prisma: PrismaClient,
  { apply }: { apply: boolean },
): Promise<MigrationReport> {
  const entries = await prisma.auditLog.findMany({
    where: { detail: { not: null }, NOT: { detail: { contains: "{{user:" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, action: true, detail: true },
  });

  const changes: { id: string; detail: string }[] = [];
  const left: MigrationReport["left"] = [];
  for (const { id, action, detail } of entries) {
    const legacy = parseLegacyDetail(action, detail!);
    if (!legacy) continue;
    const resolution =
      action === "RESULT_CORRECTED" ? await playersOfGame(prisma, legacy) : await peopleNamed(prisma, legacy);
    if ("reason" in resolution) left.push({ id, action, detail: detail!, reason: resolution.reason });
    else changes.push({ id, detail: withMentions(detail!, legacy.names, resolution.userIds) });
  }

  if (apply) {
    await prisma.$transaction(
      changes.map(({ id, detail }) => prisma.auditLog.update({ where: { id }, data: { detail } })),
    );
  }
  return { linked: changes.length, left };
}

const entries = (count: number) => `${count} ${count === 1 ? "entry" : "entries"}`;

/** The command: a dry run unless `args` has --apply, and what was done, for whoever runs it. */
export async function migrateLegacyAuditDetailsCommand(prisma: PrismaClient, args: string[]): Promise<string> {
  const apply = args.includes("--apply");
  const { linked, left } = await migrateLegacyAuditDetails(prisma, { apply });
  return [
    apply
      ? `${entries(linked)} linked to the people they name.`
      : `Dry run: ${entries(linked)} would be linked to the people they name. Run with --apply to write it.`,
    ...(left.length > 0
      ? [
          `${entries(left.length)} left as they are, for someone to review:`,
          ...left.map((entry) => `  ${entry.id} ${entry.action}: ${entry.reason}`),
        ]
      : []),
  ].join("\n");
}

if (require.main === module) {
  void runCommand(migrateLegacyAuditDetailsCommand);
}
