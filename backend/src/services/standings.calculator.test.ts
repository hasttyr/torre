import { describe, expect, it } from "vitest";

import { computeStandings, pointsFor, rankStandings } from "./standings.calculator";

describe("pointsFor", () => {
  it("maps every RN-03 result value to each side's points", () => {
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1-0" })).toEqual({ white: 1, black: 0 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "0-1" })).toEqual({ white: 0, black: 1 });
    expect(pointsFor({ whiteId: "a", blackId: "b", value: "1/2-1/2" })).toEqual({ white: 0.5, black: 0.5 });
    expect(pointsFor({ whiteId: "a", blackId: null, value: "BYE" })).toEqual({ white: 1, black: 0 });
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

    expect(rankStandings(rows, ["Sonneborn-Berger", "Buchholz"]).map((r) => r.playerId)).toEqual(["sb", "bh", "low"]);
    expect(rankStandings(rows, ["Buchholz"]).map((r) => r.playerId)).toEqual(["bh", "sb", "low"]);
  });

  it("ignores tiebreak names it can't compute (ARO) and uses a default order when none is set", () => {
    const rows = [row("a", 2, 3, 0), row("b", 2, 4, 0)];

    expect(rankStandings(rows, ["ARO"]).map((r) => r.playerId)).toEqual(["a", "b"]);
    expect(rankStandings(rows, []).map((r) => r.playerId)).toEqual(["b", "a"]);
  });
});
