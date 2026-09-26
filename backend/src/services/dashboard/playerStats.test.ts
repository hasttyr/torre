import { describe, expect, it } from "vitest";

import { emptyTally, tallyGames, totalsOf } from "./playerStats";

describe("tallyGames", () => {
  it("tallies each player's results by color and counts byes apart", () => {
    const tallies = tallyGames([
      { whiteId: "A", blackId: "B", value: "1-0" },
      { whiteId: "B", blackId: "A", value: "1/2-1/2" },
      { whiteId: "C", blackId: "A", value: "1-0" },
      { whiteId: "A", blackId: null, value: "BYE" },
    ]);

    expect(tallies.get("A")).toEqual({
      white: { wins: 1, draws: 0, losses: 0 },
      black: { wins: 0, draws: 1, losses: 1 },
      byes: 1,
      byePoints: 1,
    });
    expect(tallies.get("B")).toEqual({
      white: { wins: 0, draws: 1, losses: 0 },
      black: { wins: 0, draws: 0, losses: 1 },
      byes: 0,
      byePoints: 0,
    });
  });
});

describe("totalsOf", () => {
  it("adds the byes' configured value to points but leaves them out of the score rate", () => {
    const tally = {
      white: { wins: 1, draws: 0, losses: 0 },
      black: { wins: 0, draws: 1, losses: 1 },
      byes: 1,
      byePoints: 0.5,
    };

    expect(totalsOf(tally)).toEqual({ wins: 1, draws: 1, losses: 1, games: 3, byes: 1, points: 2, scoreRate: 0.5 });
  });

  it("reports a null score rate before any game is played", () => {
    expect(totalsOf(emptyTally()).scoreRate).toBeNull();
  });
});
