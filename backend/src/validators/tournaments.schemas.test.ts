import { describe, expect, it } from "vitest";

import { configureTournamentSchema } from "./tournaments.schemas";

const issuesOf = (input: unknown) => configureTournamentSchema.safeParse(input).error?.issues.map((i) => i.message);

describe("configureTournamentSchema tiebreaks (RN-05, HU13)", () => {
  it("accepts an ordered selection from the catalog", () => {
    const parsed = configureTournamentSchema.parse({
      tiebreakCriteria: [
        { name: "SONNEBORN_BERGER", order: 1 },
        { name: "BUCHHOLZ", order: 2 },
      ],
    });

    expect(parsed.tiebreakCriteria).toEqual([
      { name: "SONNEBORN_BERGER", order: 1 },
      { name: "BUCHHOLZ", order: 2 },
    ]);
  });

  it("refuses a criterion outside the catalog instead of silently ranking without it", () => {
    expect(issuesOf({ tiebreakCriteria: [{ name: "Bucholz", order: 1 }] })).toEqual([
      "El desempate no es uno de los disponibles",
    ]);
  });

  it("refuses two criteria in the same position", () => {
    expect(
      issuesOf({
        tiebreakCriteria: [
          { name: "BUCHHOLZ", order: 1 },
          { name: "SONNEBORN_BERGER", order: 1 },
        ],
      }),
    ).toEqual(["Cada desempate debe tener una posición distinta"]);
  });

  it("refuses the same criterion twice", () => {
    expect(
      issuesOf({
        tiebreakCriteria: [
          { name: "BUCHHOLZ", order: 1 },
          { name: "BUCHHOLZ", order: 2 },
        ],
      }),
    ).toEqual(["Un desempate no puede repetirse"]);
  });
});
