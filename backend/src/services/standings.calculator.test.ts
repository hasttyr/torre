import { describe, expect, it } from "vitest";

import { computeStandings, pointsFor, rankStandings } from "./standings.calculator";

describe("pointsFor", () => {
  it("maps every RN-03 result value to each side's points", () => {
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1-0" })).toEqual({ white: 1, black: 0 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "0-1" })).toEqual({ white: 0, black: 1 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1/2-1/2" })).toEqual({ white: 0.5, black: 0.5 });
    expect(pointsFor({ whiteId: "a", blackId: null, value: "BYE" })).toEqual({ white: 1, black: 0 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "0F-0F" })).toEqual({ white: 0, black: 0 });
  });

  it("uses the tournament's configured bye points (HU28)", () => {
    expect(pointsFor({ whiteId: "a", blackId: null, value: "BYE" }, 0.5)).toEqual({ white: 0.5, black: 0 });
  });

  it("rejects values outside the catalog", () => {
    expect(() => pointsFor({ whiteId: "a", blackId: "b", value: "2-0" })).toThrow();
  });
});

describe("computeStandings", () => {
  // Round 1: A beats B, C draws D. Round 2: A draws C, D beats B.
  const games = [
    { whiteId: "A", blackId: "B", value: "1-0" },
    { whiteId: "C", blackId: "D", value: "1/2-1/2" },
    { whiteId: "A", blackId: "C", value: "1/2-1/2" },
    { whiteId: "D", blackId: "B", value: "1-0" },
  ];

  it("computes score, Buchholz, Buchholz Cut 1 and Sonneborn-Berger", () => {
    const byPlayer = Object.fromEntries(computeStandings(games).map((row) => [row.playerId, row]));

    expect(byPlayer.A).toEqual({ playerId: "A", score: 1.5, buchholz: 1, buchholzCut1: 1, sonnebornBerger: 0.5 });
    // D: drew C (1 pt) and beat B (0 pts).
    expect(byPlayer.D).toEqual({ playerId: "D", score: 1.5, buchholz: 1, buchholzCut1: 1, sonnebornBerger: 0.5 });
    // C: opponents D (1.5) and A (1.5), both draws.
    expect(byPlayer.C).toEqual({ playerId: "C", score: 1, buchholz: 3, buchholzCut1: 1.5, sonnebornBerger: 1.5 });
    expect(byPlayer.B.score).toBe(0);
  });

  it("counts a bye as a point without adding tiebreaks", () => {
    const [row] = computeStandings([{ whiteId: "A", blackId: null, value: "BYE" }]);
    expect(row).toEqual({ playerId: "A", score: 1, buchholz: 0, buchholzCut1: 0, sonnebornBerger: 0 });
  });

  it("gives a double forfeit 0 to both, and neither an opponent for the tiebreaks (FIDE: unplayed)", () => {
    // A beat B and C beat D; then A and C never played their game: A is not
    // C's opponent for Buchholz, nor C A's.
    const byPlayer = Object.fromEntries(
      computeStandings([
        { whiteId: "A", blackId: "B", value: "1-0" },
        { whiteId: "C", blackId: "D", value: "1-0" },
        { whiteId: "A", blackId: "C", value: "0F-0F" },
      ]).map((row) => [row.playerId, row]),
    );

    expect(byPlayer.A).toEqual({ playerId: "A", score: 1, buchholz: 0, buchholzCut1: 0, sonnebornBerger: 0 });
    expect(byPlayer.C).toEqual({ playerId: "C", score: 1, buchholz: 0, buchholzCut1: 0, sonnebornBerger: 0 });
  });
});

describe("rankStandings", () => {
  const row = (playerId: string, score: number, buchholz: number, sonnebornBerger: number) => ({
    playerId,
    score,
    buchholz,
    buchholzCut1: buchholz,
    sonnebornBerger,
  });

  it("orders by score, then by the tournament's tiebreaks in their configured order", () => {
    const rows = [row("low", 1, 9, 9), row("sb", 2, 3, 5), row("bh", 2, 4, 1)];

    expect(rankStandings(rows, ["SONNEBORN_BERGER", "BUCHHOLZ"]).map((r) => r.playerId)).toEqual(["sb", "bh", "low"]);
    expect(rankStandings(rows, ["BUCHHOLZ"]).map((r) => r.playerId)).toEqual(["bh", "sb", "low"]);
  });

  it("ignores tiebreak names it can't compute (ARO) and uses a default order when none is set", () => {
    const rows = [row("a", 2, 3, 0), row("b", 2, 4, 0)];

    expect(rankStandings(rows, ["ARO"]).map((r) => r.rank)).toEqual([1, 1]);
    expect(rankStandings(rows, []).map((r) => r.playerId)).toEqual(["b", "a"]);
  });

  it("breaks a remaining tie by direct encounter (resultado particular)", () => {
    const rows = [row("a", 2, 3, 0), row("b", 2, 3, 0)];
    const games = [{ whiteId: "a", blackId: "b", value: "0-1" }];

    expect(placesOf(rankStandings(rows, ["BUCHHOLZ", "DIRECT_ENCOUNTER"], games))).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
    // Without their game on record, the tie isn't resolved.
    expect(placesOf(rankStandings(rows, ["DIRECT_ENCOUNTER"]))).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });

  // UC13 / HU13 / P12: a tie that no configured criterion resolves is shown
  // as a shared place, not as an order nobody decided.
  describe("a tie no criterion resolves", () => {
    it("is a shared place, and the next player counts the places taken", () => {
      const rows = [row("c", 1, 0, 0), row("a", 2, 3, 1), row("b", 2, 3, 1)];

      expect(placesOf(rankStandings(rows, ["BUCHHOLZ", "SONNEBORN_BERGER"]))).toEqual([
        ["a", 1],
        ["b", 1],
        ["c", 3],
      ]);
    });

    it("whatever order the players came in", () => {
      const rows = [row("b", 2, 3, 1), row("a", 2, 3, 1)];

      expect(rankStandings(rows, ["BUCHHOLZ"]).map((r) => r.rank)).toEqual([1, 1]);
    });

    it("includes a cycle of direct encounters: A beat B, B beat C, C beat A", () => {
      const rows = [row("a", 1, 2, 1), row("b", 1, 2, 1), row("c", 1, 2, 1)];
      const games = [
        { whiteId: "a", blackId: "b", value: "1-0" },
        { whiteId: "b", blackId: "c", value: "1-0" },
        { whiteId: "c", blackId: "a", value: "1-0" },
      ];

      for (const order of [rows, [...rows].reverse()]) {
        expect(rankStandings(order, ["DIRECT_ENCOUNTER"], games).map((r) => r.rank)).toEqual([1, 1, 1]);
      }
    });

    it("applies the direct encounter only among tied players who all met (FIDE)", () => {
      const rows = [row("a", 1, 2, 1), row("b", 1, 2, 1), row("c", 1, 2, 1)];
      const games = [{ whiteId: "a", blackId: "b", value: "1-0" }];

      expect(rankStandings(rows, ["DIRECT_ENCOUNTER"], games).map((r) => r.rank)).toEqual([1, 1, 1]);
    });

    it("orders by their games together when the three of them met", () => {
      const rows = [row("c", 1, 2, 1), row("b", 1, 2, 1), row("a", 1, 2, 1)];
      const games = [
        { whiteId: "a", blackId: "b", value: "1-0" },
        { whiteId: "a", blackId: "c", value: "1/2-1/2" },
        { whiteId: "b", blackId: "c", value: "1/2-1/2" },
      ];

      expect(placesOf(rankStandings(rows, ["DIRECT_ENCOUNTER"], games))).toEqual([
        ["a", 1],
        ["c", 2],
        ["b", 3],
      ]);
    });

    it("leaves a tie Buchholz resolves as it was", () => {
      const rows = [row("a", 2, 3, 0), row("b", 2, 4, 0)];

      expect(placesOf(rankStandings(rows, ["BUCHHOLZ"]))).toEqual([
        ["b", 1],
        ["a", 2],
      ]);
    });
  });
});

function placesOf(ranked: { playerId: string; rank: number }[]): [string, number][] {
  return ranked.map((r) => [r.playerId, r.rank]);
}
