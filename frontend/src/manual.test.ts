import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import es from "./i18n/locales/es.json";
import { router } from "./router";

// docs/manual-de-usuario.md quotes the interface's texts in «…» and its
// routes in backticks. Both must exist in the app as it is, so the manual
// can't describe a button that was renamed or a page that moved.
// From the frontend folder, where the tests run (the DOM environment has no file: URL to resolve from).
const manual = readFileSync(resolve(process.cwd(), "../docs/manual-de-usuario.md"), "utf8");

/** Every Spanish text of the interface. */
function texts(node: unknown): string[] {
  if (typeof node === "string") return [node];
  return node && typeof node === "object" ? Object.values(node).flatMap(texts) : [];
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A text with parameters ("Generar ronda {number}") matches any value in
// their place ("Generar ronda 1"); vue-i18n's escaped "@" counts as itself.
const patterns = texts(es).map(
  (text) =>
    new RegExp(
      `^${text
        .replace(/\{'@'\}/g, "@")
        .split(/\{\w+\}/)
        .map(escape)
        .join(".+")}$`,
    ),
);

const quoted = [...manual.matchAll(/«([^»]+)»/g)].map((match) => match[1]!);
const routes = [...new Set([...manual.matchAll(/`(\/[^`\s]*)`/g)].map((match) => match[1]!))];

/** A path as the manual writes it ("/torneos/:id/sala"), with a real id where it says ":id". */
const concrete = (path: string) => path.replace(":id", "3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b");

describe("the user manual", () => {
  it("quotes texts and routes (otherwise this test checks nothing)", () => {
    expect(quoted.length).toBeGreaterThan(50);
    expect(routes.length).toBeGreaterThan(10);
  });

  it.each(quoted)("quotes «%s» as the interface shows it", (label) => {
    expect(patterns.some((pattern) => pattern.test(label))).toBe(true);
  });

  it.each(routes)("cites %s, a page the app has", (path) => {
    expect(router.resolve(concrete(path)).name).not.toBe("not-found");
  });
});
