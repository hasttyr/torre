import { describe, expect, it } from "vitest";

import { pairRound, PairingImpossibleError, type Color, type PairingCandidate } from "./swissPairing";

function player(
  id: string,
  pairingNumber: number,
  options: { score?: number; opponents?: string[]; colors?: Color[]; hadBye?: boolean } = {},
): PairingCandidate {
  return {
    id,
    pairingNumber,
    score: options.score ?? 0,
    opponents: new Set(options.opponents ?? []),
    colors: options.colors ?? [],
    hadBye: options.hadBye ?? false,
  };
}

/** Pairings as "white-black" strings, in board order. */
const boards = (players: PairingCandidate[]) => pairRound(players).pairings.map((p) => `${p.whiteId}-${p.blackId}`);

describe("pairRound", () => {
  it("round 1: top half meets bottom half, alternating colors down the boards", () => {
    const result = pairRound([player("A", 1), player("B", 2), player("C", 3), player("D", 4)]);

    expect(result.byeId).toBeNull();
    expect(result.pairings).toEqual([
      { whiteId: "A", blackId: "C" },
      { whiteId: "D", blackId: "B" },
    ]);
  });

  it("pairs within score groups first, best scores on the top boards", () => {
    const pairs = boards([
      player("A", 1, { score: 1, colors: ["W"] }),
      player("B", 2, { score: 0, colors: ["B"] }),
      player("C", 3, { score: 1, colors: ["B"] }),
      player("D", 4, { score: 0, colors: ["W"] }),
    ]);

    expect(pairs).toEqual(["C-A", "B-D"]);
  });

  it("never repeats a previous game (RN-02)", () => {
    const pairs = boards([
      player("A", 1, { opponents: ["C"] }),
      player("B", 2),
      player("C", 3, { opponents: ["A"] }),
      player("D", 4),
    ]);

    expect(pairs.some((pair) => pair.includes("A") && pair.includes("C"))).toBe(false);
  });

  it("backtracks when the preferred opponent leads to a dead end", () => {
    // A's first choice is C, but that would leave B-D, who already met.
    const result = pairRound([
      player("A", 1),
      player("B", 2, { opponents: ["D"] }),
      player("C", 3),
      player("D", 4, { opponents: ["B"] }),
    ]);

    const pairs = result.pairings.map((p) => [p.whiteId, p.blackId].sort().join(""));
    expect(pairs.sort()).toEqual(["AD", "BC"]);
  });

  it("floats a player down when their group has nobody left they can play", () => {
    const pairs = boards([
      player("A", 1, { score: 2, opponents: ["B"] }),
      player("B", 2, { score: 2, opponents: ["A"] }),
      player("C", 3, { score: 1 }),
      player("D", 4, { score: 1 }),
    ]);

    // A and B already met, so each one drops to meet a 1-point player.
    expect(pairs.every((pair) => !(pair.includes("A") && pair.includes("B")))).toBe(true);
    expect(pairs).toHaveLength(2);
  });

  it("gives the bye to the lowest-ranked player who hasn't had one (RN-08)", () => {
    const result = pairRound([
      player("A", 1),
      player("B", 2),
      player("C", 3),
      player("D", 4),
      player("E", 5, { hadBye: true }),
    ]);

    expect(result.byeId).toBe("D");
    expect(result.pairings).toHaveLength(2);
    expect(result.pairings.flatMap((p) => [p.whiteId, p.blackId])).not.toContain("D");
  });

  it("gives white to whoever has had it less", () => {
    const [pairing] = pairRound([
      player("A", 1, { colors: ["W", "W"], score: 1 }),
      player("B", 2, { colors: ["B", "W"], score: 1 }),
    ]).pairings;

    expect(pairing).toEqual({ whiteId: "B", blackId: "A" });
  });

  it("alternates colors when both are balanced", () => {
    const [pairing] = pairRound([
      player("A", 1, { colors: ["B", "W"], score: 1 }),
      player("B", 2, { colors: ["W", "B"], score: 1 }),
    ]).pairings;

    expect(pairing).toEqual({ whiteId: "B", blackId: "A" });
  });

  it("reports when every option would repeat a game", () => {
    expect(() => pairRound([player("A", 1, { opponents: ["B"] }), player("B", 2, { opponents: ["A"] })])).toThrow(
      PairingImpossibleError,
    );
  });

  it("pairs a full round-robin-sized field over several rounds without ever repeating", () => {
    const ids = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const history = new Map(ids.map((id) => [id, new Set<string>()]));

    for (let round = 1; round <= 5; round++) {
      const result = pairRound(ids.map((id, index) => player(id, index + 1, { opponents: [...history.get(id)!] })));
      for (const { whiteId, blackId } of result.pairings) {
        expect(history.get(whiteId)!.has(blackId)).toBe(false);
        history.get(whiteId)!.add(blackId);
        history.get(blackId)!.add(whiteId);
      }
    }
  });
});
