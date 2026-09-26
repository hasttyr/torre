import { describe, expect, it } from "vitest";

import type { RoundDto } from "../round.mapper";
import type { StandingsDto } from "../standings.service";
import { pairingsDocument, standingsDocument } from "./officialDocuments";

// 2026-09-26 15:30 UTC = 10:30 in Bogotá (UTC-5).
const GENERATED_AT = new Date("2026-09-26T15:30:00Z");

const STANDINGS: StandingsDto = {
  tournamentId: "t-1",
  pending: false,
  roundsCompleted: 5,
  tiebreaks: ["Buchholz", "Sonneborn-Berger"],
  rows: [
    {
      rank: 1,
      playerId: "a",
      name: "Luis Gómez",
      score: 4.5,
      buchholz: 13,
      buchholzCut1: 11.5,
      sonnebornBerger: 12.25,
      withdrawn: false,
    },
    {
      rank: 2,
      playerId: "b",
      name: "Ana Torres",
      score: 3,
      buchholz: 12,
      buchholzCut1: 10,
      sonnebornBerger: 7,
      withdrawn: true,
    },
  ],
};

describe("standingsDocument (HU30)", () => {
  it("lists every player with points and tiebreaks, flags withdrawals, and dates the snapshot", () => {
    const document = standingsDocument(
      { name: "Copa Otoño", roundsCount: 5 },
      STANDINGS,
      GENERATED_AT,
      "America/Bogota",
    );

    expect(document.title).toBe("Copa Otoño");
    expect(document.subtitle).toBe("Clasificación oficial · 5 de 5 rondas completas");
    expect(document.notes[0]).toContain("10:30");
    // No doubled period after "a. m.": the time closes its own line.
    expect(document.notes[0]).not.toMatch(/\.\.$/);
    expect(document.notes[1]).toContain("cambios posteriores no modifican este documento");
    expect(document.notes[2]).toBe("Desempates en orden: Buchholz › Sonneborn-Berger.");
    expect(document.tables[0].rows).toEqual([
      ["1", "Luis Gómez", "4,5", "13", "11,5", "12,25"],
      ["2", "Ana Torres (retirado)", "3", "12", "10", "7"],
    ]);
  });

  it("says so when the standings are still provisional", () => {
    const document = standingsDocument(
      { name: "Liga", roundsCount: 5 },
      { ...STANDINGS, pending: true, roundsCompleted: 2 },
      GENERATED_AT,
      "America/Bogota",
    );

    expect(document.subtitle).toBe(
      "Clasificación provisional: faltan resultados de la ronda en juego · 2 de 5 rondas completas",
    );
  });
});

describe("pairingsDocument (HU30)", () => {
  it("prints every board with colors and results, and the bye as its own row", () => {
    const round: RoundDto = {
      id: "r-3",
      number: 3,
      status: "RECORDING_RESULTS",
      createdAt: GENERATED_AT,
      matches: [
        {
          id: "m-1",
          board: 1,
          status: "FINISHED",
          white: { playerId: "a", name: "Luis" },
          black: { playerId: "b", name: "Ana" },
          result: "1/2-1/2",
          isBye: false,
        },
        {
          id: "m-2",
          board: 2,
          status: "SCHEDULED",
          white: { playerId: "c", name: "Eva" },
          black: { playerId: "d", name: "Juan" },
          result: null,
          isBye: false,
        },
        {
          id: "m-3",
          board: 3,
          status: "FINISHED",
          white: { playerId: "e", name: "Sofía" },
          black: null,
          result: "BYE",
          isBye: true,
        },
      ],
    };

    const document = pairingsDocument({ name: "Liga" }, round, GENERATED_AT, "America/Bogota");

    expect(document.title).toBe("Liga — Ronda 3");
    expect(document.tables[0].rows).toEqual([
      ["1", "Luis", "½ – ½", "Ana"],
      ["2", "Eva", "", "Juan"],
      ["3", "Sofía", "Bye", "—"],
    ]);
  });
});
