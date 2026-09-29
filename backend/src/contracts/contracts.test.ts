import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as databaseEnums from "../generated/prisma/enums";
import { registerSchema } from "../validators/auth.schemas";
import { dataRequestSchema } from "../validators/users.schemas";
import {
  DATA_REQUEST_STATUSES,
  DATA_REQUEST_TYPES,
  DISABILITIES,
  GENDERS,
  MATCH_STATUSES,
  ROUND_STATUSES,
  SELF_ASSIGNABLE_ROLES,
  TIEBREAKS,
  TOURNAMENT_STATUSES,
  USER_STATUSES,
} from "./catalogs";

const sorted = (values: Iterable<unknown>) => [...values].map(String).sort();

describe("the API contract", () => {
  it.each([
    ["UserStatus", USER_STATUSES],
    ["Gender", GENDERS],
    ["Disability", DISABILITIES],
    ["TournamentStatus", TOURNAMENT_STATUSES],
    ["RoundStatus", ROUND_STATUSES],
    ["MatchStatus", MATCH_STATUSES],
    ["Tiebreak", TIEBREAKS],
    ["DataRequestType", DATA_REQUEST_TYPES],
    ["DataRequestStatus", DATA_REQUEST_STATUSES],
  ] as const)("lists the same %s values the database stores", (name, catalog) => {
    expect(sorted(Object.values(databaseEnums[name]))).toEqual(sorted(catalog));
  });

  it("lets a person register with exactly the self-assignable roles", () => {
    const roles = registerSchema.options.flatMap((option) => [...option.shape.role.values]);

    expect(sorted(roles)).toEqual(sorted(SELF_ASSIGNABLE_ROLES));
  });

  it("accepts exactly its data-subject request types", () => {
    const types = dataRequestSchema.options.flatMap((option) => [...option.shape.type.values]);

    expect(sorted(types)).toEqual(sorted(DATA_REQUEST_TYPES));
  });

  it("depends on nothing outside its folder, so the frontend can compile it too", () => {
    const sources = readdirSync(__dirname).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    const imports = sources.flatMap((file) =>
      [...readFileSync(resolve(__dirname, file), "utf-8").matchAll(/(?:from|import) "([^"]+)"/g)].map(
        (match) => match[1],
      ),
    );

    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) expect(specifier).toMatch(/^\.\/[\w.]+$/);
  });
});
