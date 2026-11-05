import { describe, expect, it } from "vitest";

import { computeStandings, pointsFor, rankStandings } from "./standings.calculator";

describe("pointsFor", () => {
  it("maps every RN-03 result value to each side's points", () => {
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1-0" })).toEqual({ white: 1, black: 0 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "0-1" })).toEqual({ white: 0, black: 1 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1/2-1/2" })).toEqual({ white: 0.5, black: 0.5 });
    expect(pointsFor({ whiteId: "a", blackId: null, value: "BYE" })).toEqual({ white: 1, black: 0 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "0F-0F" })).toEqual({ white: 0, black: 0 });
    // A forfeit: whoever showed up gets the point.
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1F-0F" })).toEqual({ white: 1, black: 0 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "0F-1F" })).toEqual({ white: 0, black: 1 });
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

  // FIDE C.07 (from 1 March 2026), art. 16.4: for their own tiebreaks, a
  // participant plays each unplayed round against a dummy with their own
  // score, capped at a draw's points times the rounds (16.4.2), and scores
  // what the round awarded. Decision 012.
  describe("an unplayed round (decision 012)", () => {
    const byPlayer = (games: { whiteId: string; blackId: string | null; value: string }[], roundsCount?: number) =>
      Object.fromEntries(computeStandings(games, 1, { roundsCount }).map((row) => [row.playerId, row]));

    it("plays a bye against a dummy with the player's own score", () => {
      expect(byPlayer([{ whiteId: "A", blackId: null, value: "BYE" }]).A).toEqual({
        playerId: "A",
        score: 1,
        buchholz: 1,
        // Its only contribution is the one Cut 1 removes.
        buchholzCut1: 0,
        sonnebornBerger: 1,
      });
    });

    it("caps the dummy's score at a draw's points times the tournament's rounds (16.4.2)", () => {
      expect(byPlayer([{ whiteId: "A", blackId: null, value: "BYE" }], 1).A).toMatchObject({
        buchholz: 0.5,
        sonnebornBerger: 0.5,
      });
    });

    // The issue's case: five players, an odd field, two rounds. E (bye in
    // round 1) and C tie on 2 points; with the bye worth nothing to its
    // Buchholz, E used to come out level with C or behind.
    it("no longer leaves whoever had the bye behind on Buchholz among the tied", () => {
      const rows = byPlayer(
        [
          { whiteId: "A", blackId: "B", value: "1-0" },
          { whiteId: "C", blackId: "D", value: "1-0" },
          { whiteId: "E", blackId: null, value: "BYE" },
          { whiteId: "A", blackId: "E", value: "0-1" },
          { whiteId: "C", blackId: "B", value: "1-0" },
          { whiteId: "D", blackId: null, value: "BYE" },
        ],
        2,
      );

      // E: A (1) plus the dummy, 2 points capped at 1 (½ × 2 rounds). C: D (1) and B (0).
      expect([rows.E!.score, rows.E!.buchholz]).toEqual([2, 2]);
      expect([rows.C!.score, rows.C!.buchholz]).toEqual([2, 1]);
      // Opponents count a bye with the points it awarded (16.3): D's 1 is
      // C's Buchholz, as if D had won that round.
      expect(rows.D!.score).toBe(1);
    });

    it("plays a forfeit against a dummy capped at the absent opponent's score (16.4.1)", () => {
      // A beat B, C beat D; then C didn't show up against A.
      const rows = byPlayer([
        { whiteId: "A", blackId: "B", value: "1-0" },
        { whiteId: "C", blackId: "D", value: "1-0" },
        { whiteId: "C", blackId: "A", value: "0F-1F" },
      ]);

      // A (2 points): B's 0 and a dummy capped at C's 1, won.
      expect(rows.A).toEqual({ playerId: "A", score: 2, buchholz: 1, buchholzCut1: 1, sonnebornBerger: 1 });
      // C (1 point): D's 0 and a dummy capped at its own 1, lost. A forfeit
      // loss is a voluntary unplayed round: Cut 1 removes it first (16.5).
      expect(rows.C).toEqual({ playerId: "C", score: 1, buchholz: 1, buchholzCut1: 0, sonnebornBerger: 0 });
    });

    it("counts a double forfeit as a loss to a dummy for both", () => {
      const rows = byPlayer([
        { whiteId: "A", blackId: "B", value: "1-0" },
        { whiteId: "C", blackId: "D", value: "1-0" },
        { whiteId: "A", blackId: "C", value: "0F-0F" },
      ]);

      expect(rows.A).toEqual({ playerId: "A", score: 1, buchholz: 1, buchholzCut1: 0, sonnebornBerger: 0 });
      expect(rows.C).toEqual({ playerId: "C", score: 1, buchholz: 1, buchholzCut1: 0, sonnebornBerger: 0 });
    });
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

    it("doesn't count a forfeit as their direct encounter", () => {
      const rows = [row("a", 1, 2, 1), row("b", 1, 2, 1)];
      const games = [{ whiteId: "a", blackId: "b", value: "1F-0F" }];

      expect(rankStandings(rows, ["DIRECT_ENCOUNTER"], games).map((r) => r.rank)).toEqual([1, 1]);
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
