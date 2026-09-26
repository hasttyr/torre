import { describe, expect, it } from "vitest";

import { candidatesFromHistory, drawPairingNumbers } from "./pairingHistory";

describe("drawPairingNumbers", () => {
  it("gives every player a distinct number from 1 to n", () => {
    const numbers = drawPairingNumbers(["a", "b", "c", "d"]);

    expect([...numbers.values()].sort()).toEqual([1, 2, 3, 4]);
    expect([...numbers.keys()].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("is reproducible with the same random source", () => {
    const fixed = () => 0.42;
    expect(drawPairingNumbers(["a", "b", "c"], fixed)).toEqual(drawPairingNumbers(["a", "b", "c"], fixed));
  });
});

describe("candidatesFromHistory", () => {
  it("derives score, opponents, color sequence and bye from the games played", () => {
    const games = [
      { round: 2, whiteId: "b", blackId: "a", value: "1/2-1/2" },
      { round: 1, whiteId: "a", blackId: "c", value: "1-0" },
      { round: 1, whiteId: "b", blackId: null, value: "BYE" },
    ];

    const [a, b] = candidatesFromHistory(
      [
        { id: "a", pairingNumber: 1 },
        { id: "b", pairingNumber: 2 },
      ],
      games,
      0.5,
    );

    expect(a).toMatchObject({ score: 1.5, colors: ["W", "B"], hadBye: false });
    expect([...a.opponents].sort()).toEqual(["b", "c"]);
    // The bye counts with the tournament's configured value (0.5 here).
    expect(b).toMatchObject({ score: 1, colors: ["W"], hadBye: true });
  });
});
