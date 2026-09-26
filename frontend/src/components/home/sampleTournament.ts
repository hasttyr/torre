// One made-up tournament for the landing's illustrations, so the hero, the
// pairings and the standings tell the same story: round 3 of a seven-player
// Swiss (hence the bye), with Ríos winning on board 1 to lead on 3/3.

export const SAMPLE_PAIRINGS = [
  { board: 1, white: "V. Ríos", black: "S. Mejía", result: "1-0" },
  { board: 2, white: "C. Duarte", black: "A. Ortiz", result: "1/2-1/2" },
  { board: 3, white: "L. Gómez", black: "M. Castro", result: null },
  { board: 4, white: "D. Pérez", black: null, result: null },
] as const;

export const SAMPLE_STANDINGS = [
  { name: "V. Ríos", points: 3, buchholz: 5.5, sonneborn: 4.5 },
  { name: "C. Duarte", points: 2.5, buchholz: 6, sonneborn: 3.5 },
  { name: "A. Ortiz", points: 2.5, buchholz: 5, sonneborn: 3 },
  { name: "L. Gómez", points: 2, buchholz: 5.5, sonneborn: 2.5 },
  { name: "S. Mejía", points: 2, buchholz: 4.5, sonneborn: 2 },
] as const;

/** The Spanish Opening after 3…a6: the position on the hero's board. */
export const SAMPLE_POSITION = "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R";
