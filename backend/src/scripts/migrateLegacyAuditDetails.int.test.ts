import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { prisma } from "../config/prisma";
import type { AuditAction } from "../contracts/catalogs";
import { bearer, createTournament, createUser, resetDatabase, type TestUser } from "../testing/testDatabase";
import { migrateLegacyAuditDetails, migrateLegacyAuditDetailsCommand } from "./migrateLegacyAuditDetails";

const app = createApp();

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** An entry as the services wrote them before details referenced people by id. */
function writeLegacyEntry(author: TestUser, action: AuditAction, detail: string) {
  return prisma.auditLog.create({ data: { userId: author.id, action, detail }, select: { id: true } });
}

async function storedDetails(): Promise<string[]> {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" }, select: { detail: true } });
  return logs.map((log) => log.detail ?? "");
}

async function readLog(admin: TestUser): Promise<string[]> {
  const response = await request(app).get("/api/audit-logs").set(bearer(admin)).expect(200);
  return (response.body.entries as { detail: string }[]).map((entry) => entry.detail).sort();
}

/** Ana and Luis played board 1 of round 1 at the Copa Otoño, now finished. */
async function playedTournament() {
  const admin = await createUser(prisma, "ADMINISTRATOR");
  const organizer = await createUser(prisma, "ORGANIZER");
  const ana = await createUser(prisma, "PLAYER", { name: "Ana Torres" });
  const luis = await createUser(prisma, "PLAYER", { name: "Luis Gómez" });
  const tournament = await createTournament(prisma, organizer, { status: "FINISHED", players: [ana, luis] });
  await prisma.round.create({
    data: {
      tournamentId: tournament.id,
      number: 1,
      matches: { create: { board: 1, whiteId: ana.playerId, blackId: luis.playerId } },
    },
  });
  return { admin, ana, luis };
}

describe("migrating old audit entries (HU22)", () => {
  it("ties each name to its person: the log reads the same, and a later suppression hides the name", async () => {
    const { admin, ana } = await playedTournament();
    await writeLegacyEntry(admin, "ROLE_CHANGED", "Ana Torres (PLAYER -> COACH)");
    await writeLegacyEntry(admin, "ACCOUNT_STATUS_CHANGED", "Luis Gómez -> INACTIVE");
    await writeLegacyEntry(
      admin,
      "RESULT_CORRECTED",
      '"Copa Otoño", ronda 1, mesa 1 (Ana Torres – Luis Gómez): WHITE_WIN → DRAW',
    );
    await writeLegacyEntry(admin, "PAIRING_ADJUSTED", 'Ronda 1 de "Copa Otoño": Ana Torres ↔ Luis Gómez — cambio');
    await writeLegacyEntry(admin, "PLAYER_WITHDRAWN", 'Luis Gómez de "Copa Otoño" — viaje');
    const before = await readLog(admin);

    const report = await migrateLegacyAuditDetails(prisma, { apply: true });

    expect(report).toEqual({ linked: 5, left: [] });
    expect(await readLog(admin)).toEqual(before);
    expect((await storedDetails()).join("\n")).not.toMatch(/Ana Torres|Luis Gómez/);

    await request(app).post("/api/users/me/data-requests").set(bearer(ana)).send({ type: "SUPPRESSION" }).expect(200);
    expect((await readLog(admin)).join("\n")).not.toContain("Ana Torres");
  });

  it("leaves an entry it can't tie to exactly one person as it is, and says which and why", async () => {
    const { admin } = await playedTournament();
    await createUser(prisma, "PLAYER", { name: "Pedro Ruiz" });
    await createUser(prisma, "COACH", { name: "Pedro Ruiz" });
    const twoPedros = await writeLegacyEntry(admin, "ROLE_CHANGED", "Pedro Ruiz (PLAYER -> COACH)");
    const nobody = await writeLegacyEntry(admin, "ACCOUNT_STATUS_CHANGED", "Marta Díaz -> INACTIVE");
    const noSuchGame = await writeLegacyEntry(
      admin,
      "RESULT_CORRECTED",
      '"Copa Otoño", ronda 4, mesa 1 (Ana Torres – Luis Gómez): WHITE_WIN → DRAW',
    );
    const stored = await storedDetails();

    const report = await migrateLegacyAuditDetails(prisma, { apply: true });

    expect(report.linked).toBe(0);
    expect(report.left).toHaveLength(3);
    expect(report.left).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: twoPedros.id,
          action: "ROLE_CHANGED",
          reason: expect.stringContaining("Pedro Ruiz"),
        }),
        expect.objectContaining({ id: nobody.id, reason: expect.stringContaining("Marta Díaz") }),
        expect.objectContaining({ id: noSuchGame.id, reason: expect.stringContaining("ronda 4, mesa 1") }),
      ]),
    );
    expect(await storedDetails()).toEqual(stored);
  });

  it("changes nothing on a dry run, and nothing more on a second run", async () => {
    const { admin } = await playedTournament();
    await writeLegacyEntry(admin, "ROLE_CHANGED", "Ana Torres (PLAYER -> COACH)");
    const stored = await storedDetails();

    expect(await migrateLegacyAuditDetails(prisma, { apply: false })).toEqual({ linked: 1, left: [] });
    expect(await storedDetails()).toEqual(stored);

    await migrateLegacyAuditDetails(prisma, { apply: true });
    expect(await migrateLegacyAuditDetails(prisma, { apply: true })).toEqual({ linked: 0, left: [] });
  });

  it("as a command: a dry run unless told --apply, saying what it did", async () => {
    const { admin } = await playedTournament();
    await writeLegacyEntry(admin, "ROLE_CHANGED", "Ana Torres (PLAYER -> COACH)");
    await writeLegacyEntry(admin, "ACCOUNT_STATUS_CHANGED", "Marta Díaz -> INACTIVE");

    const dryRun = await migrateLegacyAuditDetailsCommand(prisma, []);
    expect(dryRun).toMatch(/dry run/i);
    expect(dryRun).toContain("1 entry would be linked");
    expect(dryRun).toContain("Marta Díaz");

    const applied = await migrateLegacyAuditDetailsCommand(prisma, ["--apply"]);
    expect(applied).toContain("1 entry linked");
    expect((await storedDetails()).join("\n")).not.toContain("Ana Torres");
  });
});
