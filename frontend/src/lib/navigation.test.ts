import { describe, expect, it } from "vitest";

import { router } from "../router";
import { navLinks } from "./navigation";

// The header's sections, straight from the app's route table: a route
// declares whether it's in the nav, and who may open it.
const linksFor = (role: string) => navLinks(router.getRoutes(), role).map((link) => link.to);

describe("navLinks", () => {
  it.each([
    ["PLAYER", ["/panel", "/mis-torneos", "/en-juego"]],
    ["COACH", ["/panel", "/mis-jugadores", "/en-juego"]],
    ["ARBITER", ["/panel", "/en-juego"]],
    ["ORGANIZER", ["/panel", "/torneos", "/clubes"]],
    ["ADMINISTRATOR", ["/panel", "/torneos", "/clubes", "/usuarios", "/auditoria"]],
  ])("gives %s the sections its role can open, in the nav's order", (role, expected) => {
    expect(linksFor(role)).toEqual(expected);
  });

  it("never lists a section the role's route guard would turn away", () => {
    for (const role of ["PLAYER", "COACH", "ARBITER", "ORGANIZER", "ADMINISTRATOR"]) {
      for (const link of navLinks(router.getRoutes(), role)) {
        const allowed = router.resolve(link.to).meta.roles;
        expect(!allowed || allowed.includes(role), `${role} → ${link.to}`).toBe(true);
      }
    }
  });

  it("labels each section", () => {
    expect(navLinks(router.getRoutes(), "PLAYER").map((link) => link.labelKey)).toEqual([
      "header.panel",
      "header.tournaments",
      "header.live",
    ]);
  });
});
