import { describe, expect, it } from "vitest";

import { fenSquares } from "./fen";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

describe("fenSquares", () => {
  it("reads a position into 64 squares, from a8 across to h1", () => {
    const squares = fenSquares(START);

    expect(squares).toHaveLength(64);
    expect(squares[0]).toEqual({ piece: "r", side: "black" });
    expect(squares[4]).toEqual({ piece: "k", side: "black" });
    expect(squares[60]).toEqual({ piece: "k", side: "white" });
    expect(squares[63]).toEqual({ piece: "r", side: "white" });
  });

  it("leaves as many squares empty as each digit says", () => {
    const squares = fenSquares("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R");

    expect(squares[1]).toBeNull();
    expect(squares[18]).toEqual({ piece: "n", side: "black" });
    expect(squares[36]).toEqual({ piece: "p", side: "white" });
    expect(squares.filter((square) => square === null)).toHaveLength(32);
  });

  it("ignores everything after the piece placement (side to move, castling…)", () => {
    expect(fenSquares(`${START} w KQkq - 0 1`)).toEqual(fenSquares(START));
  });
});
