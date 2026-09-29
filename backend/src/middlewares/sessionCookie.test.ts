import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";

import { rejectCrossSiteWrites, sessionCookieOf } from "./sessionCookie";

const APP = "https://torre.example";

function requestWith(method: string, headers: Record<string, string>): Request {
  const lowercase = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return { method, header: (name: string) => lowercase[name.toLowerCase()] } as unknown as Request;
}

/** What rejectCrossSiteWrites passes on: undefined to let the request through, else the error's code. */
function outcome(method: string, headers: Record<string, string>): string | undefined {
  const next = vi.fn();
  rejectCrossSiteWrites([`${APP}/`])(requestWith(method, headers), {} as never, next);
  return (next.mock.calls[0]![0] as { code?: string } | undefined)?.code;
}

const WITH_SESSION = { cookie: "theme=dark; torre_session=abc.def.ghi" };

describe("sessionCookieOf", () => {
  it("reads the session token among the request's other cookies", () => {
    expect(sessionCookieOf(requestWith("GET", WITH_SESSION))).toBe("abc.def.ghi");
    expect(sessionCookieOf(requestWith("GET", { cookie: "theme=dark" }))).toBeNull();
    expect(sessionCookieOf(requestWith("GET", {}))).toBeNull();
  });
});

describe("rejectCrossSiteWrites", () => {
  it("lets a change through from the app's own origin, however it's written", () => {
    expect(outcome("POST", { ...WITH_SESSION, origin: APP })).toBeUndefined();
    expect(outcome("DELETE", { ...WITH_SESSION, referer: `${APP}/torneos/1` })).toBeUndefined();
  });

  it("refuses a change from another origin, or one that doesn't say where it comes from", () => {
    expect(outcome("POST", { ...WITH_SESSION, origin: "https://evil.example" })).toBe("CROSS_SITE_REQUEST");
    expect(outcome("PATCH", { ...WITH_SESSION, referer: "not a url" })).toBe("CROSS_SITE_REQUEST");
    expect(outcome("PUT", WITH_SESSION)).toBe("CROSS_SITE_REQUEST");
  });

  // Fetch Metadata: the browser itself says where the request comes from, in
  // a header no page can set, so a wrong CORS_ORIGIN or a proxy that drops
  // Origin can't block the app's own changes.
  it("trusts the browser's word that a change comes from the page's own origin", () => {
    expect(outcome("POST", { ...WITH_SESSION, "sec-fetch-site": "same-origin" })).toBeUndefined();
    expect(outcome("PUT", { ...WITH_SESSION, "sec-fetch-site": "same-origin", origin: "https://other.example" })).toBe(
      undefined,
    );
  });

  it("refuses a change the browser marks as coming from another site", () => {
    expect(outcome("POST", { ...WITH_SESSION, "sec-fetch-site": "cross-site", origin: APP })).toBe(
      "CROSS_SITE_REQUEST",
    );
    expect(outcome("DELETE", { ...WITH_SESSION, "sec-fetch-site": "same-site" })).toBe("CROSS_SITE_REQUEST");
  });

  it("doesn't check reads, nor requests without the session cookie", () => {
    expect(outcome("GET", { ...WITH_SESSION, origin: "https://evil.example" })).toBeUndefined();
    expect(outcome("POST", { authorization: "Bearer abc", origin: "https://evil.example" })).toBeUndefined();
  });
});
