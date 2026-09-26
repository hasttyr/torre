import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { exportPairingsPdf, exportStandingsPdf } from "./exports.service";

vi.mock("./pdfRenderer", () => ({ renderOfficialPdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-fake")) }));

const TOURNAMENT = { id: "t-1", name: "Copa Otoño 2025", status: "IN_PROGRESS", organizerId: "org-1", roundsCount: 5 };

function buildPrismaMock() {
  return {
    tournament: { findUnique: vi.fn().mockResolvedValue(TOURNAMENT) },
    standing: { findMany: vi.fn().mockResolvedValue([]) },
    round: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    tiebreakCriterion: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

const asClient = (prisma: ReturnType<typeof buildPrismaMock>) => prisma as unknown as PrismaClient;

describe("exportStandingsPdf (HU30)", () => {
  it("lets any arbiter export, naming the file after the tournament", async () => {
    const file = await exportStandingsPdf(asClient(buildPrismaMock()), "t-1", { id: "arb-1", role: "ARBITER" });

    expect(file.filename).toBe("clasificacion-copa-otono-2025.pdf");
    expect(file.content.toString()).toBe("%PDF-fake");
  });

  it.each([
    ["a player", { id: "p-1", role: "PLAYER" }],
    ["an organizer of another tournament", { id: "org-2", role: "ORGANIZER" }],
  ])("refuses %s", async (_label, actor) => {
    await expect(exportStandingsPdf(asClient(buildPrismaMock()), "t-1", actor)).rejects.toMatchObject({ status: 403 });
  });
});

describe("exportPairingsPdf (HU30)", () => {
  it("only exports published rounds: a draft isn't official yet", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 2,
      status: "GENERATED",
      matches: [],
      tournament: TOURNAMENT,
    });

    await expect(exportPairingsPdf(asClient(prisma), "r-1", { id: "org-1", role: "ORGANIZER" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("exports a published round for its organizer", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue({
      id: "r-1",
      number: 2,
      status: "RECORDING_RESULTS",
      createdAt: new Date(),
      matches: [],
      tournament: TOURNAMENT,
    });

    const file = await exportPairingsPdf(asClient(prisma), "r-1", { id: "org-1", role: "ORGANIZER" });

    expect(file.filename).toBe("ronda-2-copa-otono-2025.pdf");
  });

  it("responds 404 for an unknown round", async () => {
    const prisma = buildPrismaMock();
    prisma.round.findUnique.mockResolvedValue(null);

    await expect(exportPairingsPdf(asClient(prisma), "nope", { id: "org-1", role: "ORGANIZER" })).rejects.toMatchObject(
      {
        status: 404,
      },
    );
  });
});
