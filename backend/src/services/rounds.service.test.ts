import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitToTournament } from "../sockets/broadcast";
import { discardRound, generateRound, listRounds, publishRound, swapPlayers } from "./rounds.service";
import { recalculateStandings } from "./standings.service";

vi.mock("../sockets/broadcast", () => ({ emitToTournament: vi.fn() }));
vi.mock("./standings.service", () => ({ recalculateStandings: vi.fn() }));

const ORGANIZER = { id: "org-1", role: "ORGANIZER" };

function buildPrismaMock() {
  const prisma = {
    tournament: { findUnique: vi.fn(), update: vi.fn() },
    round: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: { findMany: vi.fn(), update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    match: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
      deleteMany: vi.fn(),
    },
    result: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((work: unknown) =>
    typeof work === "function" ? work(prisma) : Promise.all(work as Promise<unknown>[]),
  );
  return prisma;
}

type PrismaMock = ReturnType<typeof buildPrismaMock>;
const asClient = (prisma: PrismaMock) => prisma as unknown as PrismaClient;

const tournament = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  name: "Copa",
  organizerId: "org-1",
  status: "REGISTRATION_CLOSED",
  roundsCount: 5,
  byePoints: 1,
  ...overrides,
});

const enrollments = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ playerId: `p${index + 1}`, pairingNumber: null }));

describe("generateRound", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    prisma.round.create.mockImplementation(async ({ data }) => ({ id: "r-1", ...data, matches: [] }));
  });

  it("refuses while registration is still open", async () => {
    prisma.tournament.findUnique.mockResolvedValue(tournament({ status: "REGISTRATION_OPEN" }));

    await expect(generateRound(asClient(prisma), "t-1", ORGANIZER)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses while the previous round still has games without a result", async () => {
    prisma.tournament.findUnique.mockResolvedValue(tournament({ status: "IN_PROGRESS" }));
    prisma.round.findFirst.mockResolvedValue({ number: 2, status: "RECORDING_RESULTS" });

    await expect(generateRound(asClient(prisma), "t-1", ORGANIZER)).rejects.toMatchObject({
      status: 409,
      message: "Faltan resultados de la ronda 2",
    });
  });

  it("refuses past the configured number of rounds", async () => {
    prisma.tournament.findUnique.mockResolvedValue(tournament({ status: "IN_PROGRESS", roundsCount: 2 }));
    prisma.round.findFirst.mockResolvedValue({ number: 2, status: "STANDINGS_UPDATED" });

    await expect(generateRound(asClient(prisma), "t-1", ORGANIZER)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses an organizer who doesn't own the tournament", async () => {
    prisma.tournament.findUnique.mockResolvedValue(tournament());

    await expect(generateRound(asClient(prisma), "t-1", { id: "other", role: "ORGANIZER" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("round 1: draws pairing numbers, pairs only active players and gives the odd one out a bye", async () => {
    prisma.tournament.findUnique.mockResolvedValue(tournament());
    prisma.round.findFirst.mockResolvedValue(null);
    prisma.enrollment.findMany.mockResolvedValue(enrollments(5));

    await generateRound(asClient(prisma), "t-1", ORGANIZER);

    // RN-07: withdrawn players are filtered out at the query.
    expect(prisma.enrollment.findMany.mock.calls[0][0].where).toEqual({ tournamentId: "t-1", withdrawnAt: null });
    expect(prisma.enrollment.update).toHaveBeenCalledTimes(5);

    const created = prisma.round.create.mock.calls[0][0].data;
    expect(created.number).toBe(1);
    const boards = created.matches.create;
    expect(boards).toHaveLength(3);
    const bye = boards.find((match: { blackId?: string }) => !match.blackId);
    expect(bye).toMatchObject({ board: 3, status: "FINISHED", result: { create: { value: "BYE" } } });

    const seated = boards.flatMap((match: { whiteId: string; blackId?: string }) => [match.whiteId, match.blackId]);
    expect(seated.filter(Boolean).sort()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("later rounds keep the draw and never repeat a game", async () => {
    prisma.tournament.findUnique.mockResolvedValue(tournament({ status: "IN_PROGRESS" }));
    prisma.round.findFirst.mockResolvedValue({ number: 1, status: "STANDINGS_UPDATED" });
    prisma.enrollment.findMany.mockResolvedValue(
      enrollments(4).map((enrollment, index) => ({ ...enrollment, pairingNumber: index + 1 })),
    );
    prisma.match.findMany.mockResolvedValue([
      { whiteId: "p1", blackId: "p3", result: { value: "1-0" }, round: { number: 1 } },
      { whiteId: "p4", blackId: "p2", result: { value: "0-1" }, round: { number: 1 } },
    ]);

    await generateRound(asClient(prisma), "t-1", ORGANIZER);

    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    const pairs = prisma.round.create.mock.calls[0][0].data.matches.create.map(
      (match: { whiteId: string; blackId: string }) => [match.whiteId, match.blackId].sort().join("-"),
    );
    // Winners meet each other; the previous p1-p3 / p2-p4 games aren't repeated.
    expect(pairs.sort()).toEqual(["p1-p2", "p3-p4"]);
  });
});

describe("swapPlayers", () => {
  let prisma: PrismaMock;
  const draftMatches = [
    {
      id: "m-1",
      board: 1,
      whiteId: "p1",
      blackId: "p2",
      white: { id: "p1", user: { name: "Ana" } },
      black: { id: "p2", user: { name: "Luis" } },
    },
    {
      id: "m-2",
      board: 2,
      whiteId: "p3",
      blackId: "p4",
      white: { id: "p3", user: { name: "Eva" } },
      black: { id: "p4", user: { name: "Juan" } },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
    prisma.round.findUniqueOrThrow.mockResolvedValue({
      id: "r-1",
      number: 1,
      status: "GENERATED",
      matches: draftMatches,
    });
  });

  it("only adjusts a round before it's published (HU29)", async () => {
    prisma.round.findUnique.mockResolvedValue({ id: "r-1", status: "RECORDING_RESULTS", tournament: tournament() });

    await expect(
      swapPlayers(asClient(prisma), "r-1", { playerAId: "p1", playerBId: "p3", reason: "Pedido" }, ORGANIZER),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("swaps two players across boards and audits who did it and why (RN-09)", async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 1,
      status: "GENERATED",
      tournamentId: "t-1",
      tournament: tournament(),
    });

    await swapPlayers(asClient(prisma), "r-1", { playerAId: "p2", playerBId: "p3", reason: "Hermanos" }, ORGANIZER);

    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m-1" }, data: { blackId: "p3" } });
    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m-2" }, data: { whiteId: "p2" } });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: "org-1",
      action: "PAIRING_ADJUSTED",
      detail: expect.stringContaining("Luis ↔ Eva — Hermanos"),
    });
  });

  it("flips colors when both players share a board, with a single update", async () => {
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 1,
      status: "GENERATED",
      tournamentId: "t-1",
      tournament: tournament(),
    });

    await swapPlayers(asClient(prisma), "r-1", { playerAId: "p1", playerBId: "p2", reason: "Colores" }, ORGANIZER);

    expect(prisma.match.update).toHaveBeenCalledTimes(1);
    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m-1" }, data: { whiteId: "p2", blackId: "p1" } });
  });
});

describe("publishRound", () => {
  it("publishes a draft, starts the tournament on round 1, recalculates and broadcasts (HU09)", async () => {
    vi.clearAllMocks();
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 1,
      status: "GENERATED",
      tournamentId: "t-1",
      tournament: tournament(),
    });
    prisma.round.findUniqueOrThrow.mockResolvedValue({
      id: "r-1",
      number: 1,
      status: "RECORDING_RESULTS",
      matches: [],
    });

    await publishRound(asClient(prisma), "r-1", ORGANIZER);

    expect(prisma.round.update).toHaveBeenCalledWith({ where: { id: "r-1" }, data: { status: "RECORDING_RESULTS" } });
    expect(prisma.tournament.update).toHaveBeenCalledWith({ where: { id: "t-1" }, data: { status: "IN_PROGRESS" } });
    expect(recalculateStandings).toHaveBeenCalledWith(prisma, "t-1");
    expect(emitToTournament).toHaveBeenCalledWith("t-1", "pairing.published", { roundId: "r-1", number: 1 });
  });

  it("refuses to publish twice", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({ id: "r-1", status: "RECORDING_RESULTS", tournament: tournament() });

    await expect(publishRound(asClient(prisma), "r-1", ORGANIZER)).rejects.toMatchObject({ status: 409 });
  });
});

describe("listRounds", () => {
  it("hides draft rounds from anyone who doesn't manage the tournament (HU18)", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(tournament({ status: "IN_PROGRESS" }));
    prisma.round.findMany.mockResolvedValue([]);

    await listRounds(asClient(prisma), "t-1", { id: "u-1", role: "PLAYER" });
    await listRounds(asClient(prisma), "t-1", ORGANIZER);

    expect(prisma.round.findMany.mock.calls[0][0].where).toEqual({ tournamentId: "t-1", status: { not: "GENERATED" } });
    expect(prisma.round.findMany.mock.calls[1][0].where).toEqual({ tournamentId: "t-1" });
  });
});

describe("round cycle edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a concurrent generation of the same round as a conflict, not a server error", async () => {
    const prisma = buildPrismaMock();
    prisma.tournament.findUnique.mockResolvedValue(tournament({ status: "IN_PROGRESS" }));
    prisma.round.findFirst.mockResolvedValue({ number: 1, status: "STANDINGS_UPDATED" });
    prisma.enrollment.findMany.mockResolvedValue(
      enrollments(4).map((enrollment, index) => ({ ...enrollment, pairingNumber: index + 1 })),
    );
    prisma.round.create.mockRejectedValue({ code: "P2002" });

    await expect(generateRound(asClient(prisma), "t-1", ORGANIZER)).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to publish a draft that seats a player withdrawn after it was generated (RN-07)", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 2,
      status: "GENERATED",
      tournamentId: "t-1",
      tournament: tournament({ status: "IN_PROGRESS" }),
    });
    prisma.match.findMany.mockResolvedValue([{ whiteId: "p1", blackId: "p2" }]);
    prisma.enrollment.findFirst.mockResolvedValue({ player: { user: { name: "Luis Gómez" } } });

    await expect(publishRound(asClient(prisma), "r-1", ORGANIZER)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Luis Gómez"),
    });
    expect(prisma.enrollment.findFirst.mock.calls[0][0].where).toMatchObject({
      tournamentId: "t-1",
      playerId: { in: ["p1", "p2"] },
      withdrawnAt: { not: null },
    });
    expect(prisma.round.update).not.toHaveBeenCalled();
  });

  it("calls out in the audit trail a swap that repeats an earlier game (RN-02 exception)", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: "r-2",
      number: 2,
      status: "GENERATED",
      tournamentId: "t-1",
      tournament: tournament(),
    });
    prisma.round.findUniqueOrThrow.mockResolvedValue({
      id: "r-2",
      matches: [
        {
          id: "m-1",
          whiteId: "p1",
          blackId: "p2",
          white: { id: "p1", user: { name: "Ana" } },
          black: { id: "p2", user: { name: "Luis" } },
        },
        {
          id: "m-2",
          whiteId: "p3",
          blackId: "p4",
          white: { id: "p3", user: { name: "Eva" } },
          black: { id: "p4", user: { name: "Juan" } },
        },
      ],
    });
    // p1 and p3 already met in round 1.
    prisma.match.findMany.mockResolvedValue([
      { whiteId: "p1", blackId: "p3", result: { value: "1-0" }, round: { number: 1 } },
    ]);

    await swapPlayers(asClient(prisma), "r-2", { playerAId: "p2", playerBId: "p3", reason: "Pedido" }, ORGANIZER);

    expect(prisma.auditLog.create.mock.calls[0][0].data.detail).toContain("repite un enfrentamiento previo");
  });

  it("doesn't leave an audit entry behind when the adjustment itself fails", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 1,
      status: "GENERATED",
      tournamentId: "t-1",
      tournament: tournament(),
    });
    prisma.round.findUniqueOrThrow.mockResolvedValue({
      id: "r-1",
      matches: [
        {
          id: "m-1",
          whiteId: "p1",
          blackId: "p2",
          white: { id: "p1", user: { name: "Ana" } },
          black: { id: "p2", user: { name: "Luis" } },
        },
      ],
    });
    prisma.match.update.mockRejectedValue(new Error("db down"));

    await expect(
      swapPlayers(asClient(prisma), "r-1", { playerAId: "p1", playerBId: "p2", reason: "Colores" }, ORGANIZER),
    ).rejects.toThrow("db down");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("discardRound", () => {
  it("deletes a draft with its matches and bye, children first", async () => {
    vi.clearAllMocks();
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({ id: "r-1", status: "GENERATED", tournament: tournament() });

    await discardRound(asClient(prisma), "r-1", ORGANIZER);

    expect(prisma.result.deleteMany).toHaveBeenCalledWith({ where: { match: { roundId: "r-1" } } });
    expect(prisma.match.deleteMany).toHaveBeenCalledWith({ where: { roundId: "r-1" } });
    expect(prisma.round.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
  });

  it("never discards a published round: its results are official", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({ id: "r-1", status: "RECORDING_RESULTS", tournament: tournament() });

    await expect(discardRound(asClient(prisma), "r-1", ORGANIZER)).rejects.toMatchObject({ status: 409 });
    expect(prisma.round.delete).not.toHaveBeenCalled();
  });

  it("responds 404 for an unknown round", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue(null);

    await expect(discardRound(asClient(prisma), "nope", ORGANIZER)).rejects.toMatchObject({ status: 404 });
  });
});
