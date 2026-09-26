import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_ROLES } from "./services/adminUsers";
import { DISABILITIES, GENDERS, SELF_ASSIGNABLE_ROLES } from "./services/auth";
import { CONFIGURABLE_ROLES, WIDGET_KEYS } from "./services/dashboard";
import { GAME_RESULTS } from "./services/rounds";
import { SOCKET_EVENTS } from "./services/socket";

// Frontend and backend are separate npm projects with no shared package, so
// a few catalogs are deliberately duplicated ("Mirrors ..." comments). These
// tests read the backend's source and fail the moment the two copies drift —
// the kind of drift that once shipped data-rights requests the API rejected.
// Skipped when the frontend is checked out on its own.

const BACKEND = resolve(__dirname, "../../backend/src");
const hasBackend = existsSync(BACKEND);

function backendSource(path: string): string {
  return readFileSync(resolve(BACKEND, path), "utf-8");
}

/** The quoted string literals inside `export const NAME = [ ... ]` (or `{ ... }` values). */
function literalsOf(source: string, name: string): string[] {
  const match = new RegExp(`${name}\\s*=\\s*[[{]([\\s\\S]*?)[\\]}]`).exec(source);
  if (!match) throw new Error(`${name} not found in backend source`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((literal) => literal[1]);
}

const sorted = (values: readonly string[]) => [...values].sort();

describe.skipIf(!hasBackend)("frontend ↔ backend contracts", () => {
  it("dashboard widget catalog and configurable roles", () => {
    const catalog = backendSource("services/dashboard/widgetCatalog.ts");
    expect([...WIDGET_KEYS]).toEqual(literalsOf(catalog, "WIDGET_KEYS"));
    expect([...CONFIGURABLE_ROLES]).toEqual(literalsOf(catalog, "CONFIGURABLE_ROLES"));
  });

  it("real-time event names", () => {
    const events = literalsOf(backendSource("sockets/events.ts"), "SOCKET_EVENTS");
    expect(sorted(Object.values(SOCKET_EVENTS))).toEqual(sorted(events));
  });

  it("result values a person can record (RN-03)", () => {
    expect(sorted(GAME_RESULTS)).toEqual(
      sorted(literalsOf(backendSource("validators/rounds.schemas.ts"), "GAME_RESULTS")),
    );
  });

  it("profile catalogs (gender, disability)", () => {
    const users = backendSource("validators/users.schemas.ts");
    expect([...GENDERS]).toEqual(literalsOf(users, "GENDERS"));
    expect([...DISABILITIES]).toEqual(literalsOf(users, "DISABILITIES"));
  });

  it("role catalog: every role an administrator can assign", () => {
    const schema = backendSource("validators/users.schemas.ts");
    const assignable = /role: z\.enum\(\[([^\]]+)\]/.exec(schema)?.[1] ?? "";
    expect(sorted(ALL_ROLES)).toEqual(sorted([...assignable.matchAll(/"([^"]+)"/g)].map((match) => match[1])));
  });

  it("roles a person can self-register with", () => {
    const schema = backendSource("validators/auth.schemas.ts");
    const selfService = [...schema.matchAll(/role: z\.literal\("([A-Z]+)"\)/g)].map((match) => match[1]);
    expect(sorted(SELF_ASSIGNABLE_ROLES)).toEqual(sorted(selfService));
  });

  it("data-rights request types the privacy panel sends (HU22)", () => {
    const schema = backendSource("validators/users.schemas.ts");
    const accepted = [...schema.matchAll(/type: z\.literal\("([A-Z]+)"\)/g)].map((match) => match[1]);
    const sent = [
      ...readFileSync(resolve(__dirname, "services/dataRights.ts"), "utf-8").matchAll(/type: "([A-Z]+)"/g),
    ].map((match) => match[1]);
    expect(sent.length).toBeGreaterThan(0);
    for (const type of sent) expect(accepted).toContain(type);
  });
});
