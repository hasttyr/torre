// @vitest-environment node
import { createHash } from "node:crypto";
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

/** The headers every page gets (Vercel applies each rule whose source matches). */
const pageHeaders = (path: string) =>
  Object.fromEntries(
    vercel.headers
      .filter((rule) => matches(rule.source, path))
      .flatMap((rule) => rule.headers)
      .map((header) => [header.key, header.value]),
  );

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/** The backend on Render: the /api proxy's target, and the socket's (it can't go through Vercel). */
const API = "https://torre-be.onrender.com";

/** Where Vercel serves `path` from: the first rewrite that matches (Vercel stops there), if any. */
function rewriteOf(path: string): string | undefined {
  const rule = vercel.rewrites.find((candidate) => matches(candidate.source, path));
  if (!rule) return undefined;
  const groups = new RegExp(`^${rule.source}$`).exec(path)!.slice(1);
  return rule.destination.replace(/\$(\d)/g, (_, index: string) => groups[Number(index) - 1] ?? "");
}

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
    expect(rewriteOf("/torneos/abc/sala")).toBe("/index.html");
    expect(rewriteOf("/")).toBe("/index.html");
    expect(rewriteOf("/assets/PanelView-old.js")).toBeUndefined();
  });

  it("builds the app with the socket pointed at the same backend (.env.production, read by every build)", () => {
    const productionEnv = readFileSync(new URL("../.env.production", import.meta.url), "utf8");

    expect(productionEnv).toMatch(new RegExp(`^VITE_SOCKET_URL=${API}$`, "m"));
  });

  it("sends /api to the API on Render, from the app's own site: its session cookie is first-party", () => {
    expect(rewriteOf("/api/auth/login")).toBe(`${API}/api/auth/login`);
    expect(rewriteOf("/api/tournaments/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/rounds")).toBe(
      `${API}/api/tournaments/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/rounds`,
    );
  });
});

describe("security headers", () => {
  const headers = pageHeaders("/torneos/3f2b8c1e-6a4d-4e2f-9b7a-1c5d8e9f0a2b/sala");

  it("go on every page", () => {
    expect(headers).toMatchObject({
      "Strict-Transport-Security": expect.stringContaining("max-age="),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": expect.stringContaining("camera=()"),
    });
  });

  it("enforce the content security policy, instead of only reporting it", () => {
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(headers).not.toHaveProperty("Content-Security-Policy-Report-Only");
  });

  it("limit scripts to the app's own files and the inline theme script, as it is now", () => {
    // Editing that script without updating its hash here would block it: this fails first.
    const inline = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)![1]!;
    const hash = createHash("sha256").update(inline).digest("base64");
    const policy = headers["Content-Security-Policy"]!;

    expect(policy).toContain(`script-src 'self' 'sha256-${hash}'`);
    expect(policy).toContain("object-src 'none'");
    // The API through /api ('self'), and only the socket straight to Render.
    expect(policy).toContain(`connect-src 'self' ${API} ${API.replace("https:", "wss:")};`);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
  });
});

describe("index.html", () => {
  it("loads nothing from third parties: fonts are served with the app", () => {
    const external = [...indexHtml.matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map((match) => match[1]);

    expect(external).toEqual([]);
  });

  it("has no inline event handlers, which a strict policy would block", () => {
    expect(indexHtml).not.toMatch(/\son[a-z]+=/);
  });
});
