import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../config/prisma";
import { createTournament, createUser, raceWithChange, resetDatabase, type TestUser } from "../testing/testDatabase";
import { finishOverdueTournaments, scheduleAutoFinish } from "./autoFinish.service";
import { configureTournament } from "./tournaments.service";

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// createTournament ends on 2026-10-02: over at the end of that day in
// Bogotá, 2026-10-03 00:00 UTC-5.
const BEFORE_THE_END = new Date("2026-10-03T04:59:59Z");
const AFTER_THE_END = new Date("2026-10-03T05:00:00Z");

type Game = [white: TestUser, black: TestUser, value: string | null];

async function addRound(tournamentId: string, number: number, status: string, games: Game[]) {
  return prisma.round.create({
    data: {
      tournamentId,
      number,
      status: status as never,
      matches: {
        create: games.map(([white, black, value], index) => ({
          board: index + 1,
          whiteId: white.playerId!,
          blackId: black.playerId!,
          status: value ? "FINISHED" : "SCHEDULED",
          ...(value ? { result: { create: { value } } } : {}),
        })),
      },
    },
  });
}

/**
 * Three rounds configured, the end date past: round 1 fully played, round 2
 * published with one game never recorded, round 3 still a draft.
 */
async function tournamentLeftUnfinished() {
  const organizer = await createUser(prisma, "ORGANIZER");
  const [ana, beto, caro, dani] = await Promise.all(
    ["Ana", "Beto", "Caro", "Dani"].map((name) => createUser(prisma, "PLAYER", { name })),
  );
  const tournament = await createTournament(prisma, organizer, {
    status: "IN_PROGRESS",
    roundsCount: 3,
    players: [ana!, beto!, caro!, dani!],
  });
  await addRound(tournament.id, 1, "STANDINGS_UPDATED", [
    [ana!, beto!, "1-0"],
    [caro!, dani!, "1/2-1/2"],
  ]);
  const round2 = await addRound(tournament.id, 2, "RECORDING_RESULTS", [
    [ana!, caro!, "1-0"],
    [dani!, beto!, null],
  ]);
  await addRound(tournament.id, 3, "GENERATED", [
    [beto!, caro!, null],
    [ana!, dani!, null],
  ]);
  return { tournament, round2, players: { ana: ana!, beto: beto!, caro: caro!, dani: dani! } };
}

describe("closing a tournament past its end date (decision 010)", () => {
  it("leaves it open until its end date is over in Bogotá", async () => {
    const { tournament } = await tournamentLeftUnfinished();

    expect(await finishOverdueTournaments(prisma, BEFORE_THE_END)).toEqual({ finished: [], failed: [] });
    expect((await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).status).toBe("IN_PROGRESS");
  });

  it("leaves open a tournament its organizer extended before the date was over", async () => {
    const { tournament } = await tournamentLeftUnfinished();
    const organizer = { id: tournament.organizerId, role: "ORGANIZER" } as const;

    await configureTournament(prisma, tournament.id, { endDate: new Date("2026-10-05") }, organizer, BEFORE_THE_END);

    expect(await finishOverdueTournaments(prisma, AFTER_THE_END)).toEqual({ finished: [], failed: [] });
    expect((await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).status).toBe("IN_PROGRESS");
    const [extended] = await prisma.auditLog.findMany({ where: { action: "TOURNAMENT_END_DATE_CHANGED" } });
    expect(extended).toMatchObject({
      userId: organizer.id,
      detail: expect.stringContaining("2026-10-02 -> 2026-10-05"),
    });
    // Over at the end of its new date, like any other.
    expect(await finishOverdueTournaments(prisma, new Date("2026-10-06T05:00:00Z"))).toEqual({
      finished: [tournament.id],
      failed: [],
    });
  });

  it("closes it with what was played: a double forfeit for the unrecorded game, the draft discarded", async () => {
    const { tournament, round2, players } = await tournamentLeftUnfinished();

    expect(await finishOverdueTournaments(prisma, AFTER_THE_END)).toEqual({ finished: [tournament.id], failed: [] });

    expect((await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } })).status).toBe("FINISHED");
    const rounds = await prisma.round.findMany({ where: { tournamentId: tournament.id }, orderBy: { number: "asc" } });
    expect(rounds.map((round) => [round.number, round.status])).toEqual([
      [1, "STANDINGS_UPDATED"],
      [2, "STANDINGS_UPDATED"],
    ]);
    const unplayed = await prisma.match.findFirstOrThrow({
      where: { roundId: round2.id, whiteId: players.dani.playerId! },
      include: { result: true },
    });
    expect(unplayed.status).toBe("FINISHED");
    expect(unplayed.result?.value).toBe("0F-0F");

    // Ana 2 (beat Beto and Caro), Caro and Dani ½ each, Beto 0: the double
    // forfeit gave Dani and Beto nothing. Caro ranks over Dani on Buchholz
    // (Ana's 2 + Dani's ½), as Dani's unplayed game gives no opponent.
    const standings = await prisma.standing.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { rank: "asc" },
      include: { player: { include: { user: true } } },
    });
    expect(standings.map((row) => [row.player.user.name, Number(row.score), Number(row.buchholz)])).toEqual([
      ["Ana", 2, 0.5],
      ["Caro", 0.5, 2.5],
      ["Dani", 0.5, 0.5],
      ["Beto", 0, 2],
    ]);
  });

  it("records it in the audit log as done by the system, with no user", async () => {
    await tournamentLeftUnfinished();

    await finishOverdueTournaments(prisma, AFTER_THE_END);

    const [entry] = await prisma.auditLog.findMany({ where: { action: "TOURNAMENT_AUTO_FINISHED" } });
    expect(entry).toMatchObject({ userId: null, detail: '"Copa Otoño" · 0F-0F: 1 · rondas borrador descartadas: 1' });
  });

  it("does nothing the second time, nor to a tournament that never started", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const neverStarted = await createTournament(prisma, organizer, { status: "REGISTRATION_OPEN" });
    await tournamentLeftUnfinished();
    await finishOverdueTournaments(prisma, AFTER_THE_END);

    expect(await finishOverdueTournaments(prisma, AFTER_THE_END)).toEqual({ finished: [], failed: [] });
    expect((await prisma.tournament.findUniqueOrThrow({ where: { id: neverStarted.id } })).status).toBe(
      "REGISTRATION_OPEN",
    );
  });

  it("closes a tournament with every game recorded as it is: nothing forfeited, nothing discarded", async () => {
    const organizer = await createUser(prisma, "ORGANIZER");
    const [ana, beto] = await Promise.all(["Ana", "Beto"].map((name) => createUser(prisma, "PLAYER", { name })));
    const tournament = await createTournament(prisma, organizer, {
      status: "IN_PROGRESS",
      roundsCount: 1,
      players: [ana!, beto!],
    });
    await addRound(tournament.id, 1, "STANDINGS_UPDATED", [[ana!, beto!, "1-0"]]);

    await finishOverdueTournaments(prisma, AFTER_THE_END);

    expect((await prisma.result.findMany()).map((result) => result.value)).toEqual(["1-0"]);
    const [entry] = await prisma.auditLog.findMany({ where: { action: "TOURNAMENT_AUTO_FINISHED" } });
    expect(entry?.detail).toBe('"Copa Otoño" · 0F-0F: 0 · rondas borrador descartadas: 0');
  });

  it("leaves alone a tournament finished by hand while it waited for the lock", async () => {
    const { tournament } = await tournamentLeftUnfinished();

    const outcome = await raceWithChange(
      prisma,
      tournament.id,
      () => finishOverdueTournaments(prisma, AFTER_THE_END),
      (tx) => tx.tournament.update({ where: { id: tournament.id }, data: { status: "FINISHED" } }),
    );

    expect(outcome).toEqual({ finished: [], failed: [] });
    // No forfeits written over what the organizer closed.
    expect(await prisma.result.count({ where: { value: "0F-0F" } })).toBe(0);
  });

  it("is what a running server does on startup, and it logs what it closed", async () => {
    const { tournament } = await tournamentLeftUnfinished();
    const log = { info: vi.fn(), error: vi.fn() };

    const stop = scheduleAutoFinish(prisma, log);
    await vi.waitFor(() => expect(log.info).toHaveBeenCalled());
    stop();

    expect(log.info).toHaveBeenCalledWith({ tournaments: [tournament.id] }, "tournaments past their end date closed");
    expect(log.error).not.toHaveBeenCalled();
  });

  it("the result catalog's CHECK constraint (RN-03) admits the double forfeit, and still nothing else", async () => {
    const { round2 } = await tournamentLeftUnfinished();
    const pending = await prisma.match.findFirstOrThrow({ where: { roundId: round2.id, result: { is: null } } });

    await expect(prisma.result.create({ data: { matchId: pending.id, value: "0F-1F" } })).rejects.toThrow();
    await expect(prisma.result.create({ data: { matchId: pending.id, value: "0F-0F" } })).resolves.toBeDefined();
  });
});
