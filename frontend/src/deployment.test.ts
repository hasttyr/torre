// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
  headers: HeaderRule[];
  rewrites: { source: string; destination: string }[];
};

/** Whether a Vercel `source` pattern (a path-to-regexp; these use no named params) matches `path`. */
const matches = (source: string, path: string) => new RegExp(`^${source}$`).test(path);

const cacheControl = (source: string) =>
  vercel.headers.find((rule) => rule.source === source)?.headers.find((header) => header.key === "Cache-Control")
    ?.value;

describe("vercel.json", () => {
  it("lets browsers keep the built assets for good: their names change whenever their content does", () => {
    expect(cacheControl("/assets/(.*)")).toBe("public, max-age=31536000, immutable");
  });

  it("never caches index.html that way, so a new deploy is picked up on the next visit", () => {
    const immutable = vercel.headers.filter((rule) =>
      rule.headers.some((header) => header.value.includes("immutable")),
    );
    expect(immutable.map((rule) => rule.source)).toEqual(["/assets/(.*)"]);
  });

  it("serves the app for any page path, but a 404 for an asset a deploy removed (not index.html, kept for a year)", () => {
    const toApp = (path: string) => vercel.rewrites.some((rule) => matches(rule.source, path));

    expect(toApp("/torneos/abc/sala")).toBe(true);
    expect(toApp("/")).toBe(true);
    expect(toApp("/assets/PanelView-old.js")).toBe(false);
  });
});
