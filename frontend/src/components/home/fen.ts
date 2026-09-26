export type PieceLetter = "k" | "q" | "r" | "b" | "n" | "p";
export type Square = { piece: PieceLetter; side: "white" | "black" } | null;

/**
 * The 64 squares of a FEN position, from a8 across to h1 (the board as
 * White sees it, top row first). Only the piece placement is read.
 */
export function fenSquares(fen: string): Square[] {
  const placement = fen.split(" ")[0] ?? "";
  return [...placement.replaceAll("/", "")].flatMap((char): Square[] => {
    const empty = Number(char);
    if (empty) return Array<Square>(empty).fill(null);
    const piece = char.toLowerCase() as PieceLetter;
    return [{ piece, side: char === piece ? "black" : "white" }];
  });
}
