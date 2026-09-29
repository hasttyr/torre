import {
  API_ERRORS,
  AUDIT_ACTIONS,
  DISABILITIES,
  GENDERS,
  ROLES,
  TIEBREAKS,
  TOURNAMENT_STATUSES,
  USER_STATUSES,
  WIDGET_KEYS,
} from "@contracts";
import { describe, expect, it } from "vitest";

import en from "./i18n/locales/en.json";
import es from "./i18n/locales/es.json";

// The API contract (backend/src/contracts) is shared code: the type-checker
// keeps both sides aligned. What it can't see is whether every value the UI
// shows has words in each language; these tests do.

const LOCALES = { es, en };
const sorted = (values: Iterable<string>) => [...values].sort();

describe.each(Object.entries(LOCALES))("the %s locale words every catalog value the UI shows", (_, locale) => {
  it.each([
    ["roles", ROLES, locale.roles],
    ["tournament statuses", TOURNAMENT_STATUSES, locale.estados],
    ["account statuses", USER_STATUSES, locale.adminUsers.status],
    ["genders", GENDERS, locale.genero],
    ["disabilities", DISABILITIES, locale.discapacidad],
    ["tiebreaks", TIEBREAKS, locale.tiebreaks],
    ["audit actions", AUDIT_ACTIONS, locale.auditLog.actions],
  ] as const)("%s", (_name, catalog, labels) => {
    expect(sorted(Object.keys(labels))).toEqual(sorted(catalog));
  });

  it("dashboard widgets", () => {
    for (const key of WIDGET_KEYS) expect(locale.widgets).toHaveProperty(key);
  });

  it("error codes (a validation error brings its own per-field messages)", () => {
    const worded = Object.keys(API_ERRORS).filter((code) => code !== "VALIDATION_FAILED");

    expect(sorted(Object.keys(locale.apiErrors))).toEqual(sorted(worded));
  });
});
