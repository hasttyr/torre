import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitToTournament } from "../sockets/broadcast";
import { correctResult, recordResult } from "./results.service";
import { closeRoundIfComplete } from "./rounds.service";
import { recalculateStandings } from "./standings.service";

vi.mock("../sockets/broadcast", () => ({ emitToTournament: vi.fn() }));
vi.mock("./standings.service", () => ({ recalculateStandings: vi.fn() }));
vi.mock("./rounds.service", () => ({ closeRoundIfComplete: vi.fn() }));

function buildPrismaMock() {
  const prisma = {
    match: { findUnique: vi.fn(), update: vi.fn() },
    result: { create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "log-1" }) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: unknown) => unknown) => work(prisma));
  return prisma;
}

type PrismaMock = ReturnType<typeof buildPrismaMock>;
const asClient = (prisma: PrismaMock) => prisma as unknown as PrismaClient;

const ARBITER = { id: "arb-1", role: "ARBITER" };

function match(overrides: Record<string, unknown> = {}, tournamentOverrides: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    board: 2,
    roundId: "r-1",
    whiteId: "p1",
    blackId: "p2",
    result: null,
    white: { user: { name: "Ana" } },
    black: { user: { name: "Luis" } },
    round: {
      number: 3,
      status: "RECORDING_RESULTS",
      tournamentId: "t-1",
      tournament: { id: "t-1", name: "Copa", organizerId: "org-1", status: "IN_PROGRESS", ...tournamentOverrides },
    },
    ...overrides,
  };
}

describe("recordResult (HU10)", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
  });

  it("lets any arbiter record a result, then closes the round if complete, recalculates and broadcasts", async () => {
    prisma.match.findUnique.mockResolvedValue(match());

    await recordResult(asClient(prisma), "m-1", "1-0", ARBITER);

    expect(prisma.result.create).toHaveBeenCalledWith({ data: { matchId: "m-1", value: "1-0" } });
    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m-1" }, data: { status: "FINISHED" } });
    expect(closeRoundIfComplete).toHaveBeenCalledWith(prisma, "r-1");
    expect(recalculateStandings).toHaveBeenCalledWith(prisma, "t-1");
    expect(emitToTournament).toHaveBeenCalledWith("t-1", "match.result.recorded", {
      matchId: "m-1",
      roundId: "r-1",
      value: "1-0",
    });
    expect(emitToTournament).toHaveBeenCalledWith("t-1", "standings.updated", { tournamentId: "t-1" });
  });

  it.each([
    ["a player", { id: "p1", role: "PLAYER" }],
    ["an organizer of another tournament", { id: "other-org", role: "ORGANIZER" }],
  ])("refuses %s (RN-06)", async (_label, actor) => {
    prisma.match.findUnique.mockResolvedValue(match());

    await expect(recordResult(asClient(prisma), "m-1", "1-0", actor)).rejects.toMatchObject({ status: 403 });
    expect(prisma.result.create).not.toHaveBeenCalled();
  });

  it.each([
    ["the game already has a result", match({ result: { value: "1-0" } })],
    ["the round is still a draft", match({ round: { ...match().round, status: "GENERATED" } })],
    ["it's a bye", match({ blackId: null })],
    ["the tournament is finished (HU17)", match({}, { status: "FINISHED" })],
  ])("refuses when %s", async (_label, loaded) => {
    prisma.match.findUnique.mockResolvedValue(loaded);

    await expect(recordResult(asClient(prisma), "m-1", "1-0", ARBITER)).rejects.toMatchObject({ status: 409 });
  });

  it("reports a concurrent recording of the same board as a conflict", async () => {
    prisma.match.findUnique.mockResolvedValue(match());
    prisma.result.create.mockRejectedValue({ code: "P2002" });

    await expect(recordResult(asClient(prisma), "m-1", "1-0", ARBITER)).rejects.toMatchObject({ status: 409 });
  });
});

describe("correctResult (HU11)", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    vi.clearAllMocks();
    prisma = buildPrismaMock();
  });

  it("changes the value, marks the game CORRECTED, recalculates and audits old → new (RN-11)", async () => {
    prisma.match.findUnique.mockResolvedValue(match({ result: { value: "1-0" } }));

    await correctResult(asClient(prisma), "m-1", "0-1", "Planilla mal leída", { id: "org-1", role: "ORGANIZER" });

    expect(prisma.result.update.mock.calls[0][0]).toMatchObject({ where: { matchId: "m-1" }, data: { value: "0-1" } });
    expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: "m-1" }, data: { status: "CORRECTED" } });
    expect(recalculateStandings).toHaveBeenCalledWith(prisma, "t-1");
    expect(prisma.auditLog.create.mock.calls[0][0].data).toEqual({
      userId: "org-1",
      action: "RESULT_CORRECTED",
      detail: '"Copa", ronda 3, mesa 2 (Ana – Luis): 1-0 → 0-1 — Planilla mal leída',
    });
  });

  it("refuses when there's no result yet or the value doesn't change", async () => {
    prisma.match.findUnique.mockResolvedValueOnce(match());
    await expect(correctResult(asClient(prisma), "m-1", "0-1", undefined, ARBITER)).rejects.toMatchObject({
      status: 409,
    });

    prisma.match.findUnique.mockResolvedValueOnce(match({ result: { value: "0-1" } }));
    await expect(correctResult(asClient(prisma), "m-1", "0-1", undefined, ARBITER)).rejects.toMatchObject({
      status: 409,
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("correctResult atomicity (RN-11)", () => {
  it("fails, without broadcasting, when its audit entry can't be written", async () => {
    vi.clearAllMocks();
    const prisma = buildPrismaMock();
    prisma.match.findUnique.mockResolvedValue(match({ result: { value: "1-0" } }));
    prisma.auditLog.create.mockRejectedValue(new Error("audit table unavailable"));

    await expect(correctResult(asClient(prisma), "m-1", "0-1", undefined, ARBITER)).rejects.toThrow(
      "audit table unavailable",
    );
    // The audit write runs inside the transaction: its failure rolls the
    // correction back, and nobody is told about a change that didn't happen.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(emitToTournament).not.toHaveBeenCalled();
  });
});
