import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test, visit } from "../fixtures.ts";

// Security (RNF01), from outside: what an attacker with a browser or curl
// would try against the running app, on top of the unit and integration
// tests that check each guard from inside (plan de pruebas, NF-01 to NF-03).
// Everything goes through the app's own origin, as in production, except the
// CORS check, which needs to reach the API from another one.

const API = "http://localhost:4100";
// A change carried by the session cookie must say it comes from the app
// (rejectCrossSiteWrites, anti-CSRF), as the browser does on its own.
const FROM_APP = { Origin: "http://localhost:4173" };

/** The id of a tournament from the public listing, by its name in the seed. */
async function publicTournamentId(request: APIRequestContext, name: string): Promise<string> {
  const rooms = (await (await request.get("/api/tournaments/public/rooms")).json()) as { id: string; name: string }[];
  return rooms.find((room) => room.name === name)!.id;
}

test.describe("headers", () => {
  test("the app forbids inline scripts, framing and sniffing", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    const csp = headers["content-security-policy"];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp.match(/script-src [^;]*/)![0]).not.toContain("'unsafe-inline'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("the API doesn't say what it runs on, and answers with personal data aren't cached", async ({ signInAs }) => {
    const page = await signInAs("player@test.com");
    const headers = (await page.request.get("/api/users/me")).headers();

    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["cache-control"]).toContain("no-store");
  });

  test("another site's pages can't call the API from their visitors' browsers (CORS)", async ({ request }) => {
    const answer = await request.get(`${API}/api/health`, { headers: { Origin: "https://evil.example" } });

    expect(answer.headers()["access-control-allow-origin"]).not.toBe("https://evil.example");
    expect(answer.headers()["access-control-allow-origin"]).not.toBe("*");
  });
});

test.describe("authentication", () => {
  // Every route that needs a session, asked without one.
  const PROTECTED = [
    ["GET", "/api/users/me"],
    ["GET", "/api/users"],
    ["GET", "/api/audit-logs"],
    ["GET", "/api/players"],
    ["GET", "/api/clubs"],
    ["GET", "/api/dashboard"],
    ["GET", "/api/tournaments/mine"],
    ["GET", "/api/tournaments/live"],
    ["GET", "/api/coaches/players"],
    ["POST", "/api/tournaments"],
    ["POST", "/api/auth/logout"],
  ] as const;

  for (const [method, path] of PROTECTED) {
    test(`${method} ${path} without a session is refused (401)`, async ({ request }) => {
      const answer = await request.fetch(path, { method, headers: FROM_APP, data: method === "POST" ? {} : undefined });
      expect(answer.status()).toBe(401);
    });
  }

  test("a forged or tampered session cookie is refused", async ({ signInAs }) => {
    const page = await signInAs("player@test.com");
    const context = page.context();
    const session = (await context.cookies()).find((cookie) => cookie.name === "torre_session")!;

    // The same token with its signature changed, and one signed with a guessed secret.
    const [header, payload, signature] = session.value.split(".");
    const flipped = `${signature!.slice(0, -2)}${signature!.endsWith("AA") ? "BB" : "AA"}`;
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin", role: "ADMINISTRATOR" })).toString("base64url");
    for (const value of [`${header}.${payload}.${flipped}`, `${header}.${forgedPayload}.${signature}`, "not-a-token"]) {
      await context.addCookies([{ ...session, value }]);
      expect((await page.request.get("/api/users/me")).status(), value).toBe(401);
    }
  });

  test("a change another site's page makes with the user's cookie is refused (CSRF)", async ({ signInAs }) => {
    const page = await signInAs("organizer@test.com");
    const data = { name: "Torneo de otro sitio", startDate: "2026-12-01", endDate: "2026-12-02" };

    const attempts: Record<string, string>[] = [
      { Origin: "https://evil.example" },
      { Referer: "https://evil.example/form" },
      {},
    ];
    for (const headers of attempts) {
      const answer = await page.request.post("/api/tournaments", { data, headers });
      expect([answer.status(), (await answer.json()).code], JSON.stringify(headers)).toEqual([
        403,
        "CROSS_SITE_REQUEST",
      ]);
    }
    // Reads aren't changes: they still work from the app.
    expect((await page.request.get("/api/tournaments/mine")).status()).toBe(200);
  });

  test("a wrong password and an unknown account get the same answer: no account enumeration", async ({ request }) => {
    const wrongPassword = await request.post("/api/auth/login", {
      data: { email: "player@test.com", password: "not-the-password" },
    });
    const unknownAccount = await request.post("/api/auth/login", {
      data: { email: "nobody-here@test.com", password: "not-the-password" },
    });

    expect(wrongPassword.status()).toBe(401);
    expect(unknownAccount.status()).toBe(401);
    expect(await unknownAccount.json()).toEqual(await wrongPassword.json());
  });

  test("guessing one account's password is cut off after 10 failed attempts (429)", async ({ request }) => {
    const email = `brute-force-${Date.now()}@test.com`;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const answer = await request.post("/api/auth/login", { data: { email, password: `guess-${attempt}` } });
      expect(answer.status(), `attempt ${attempt}`).toBe(401);
    }

    const eleventh = await request.post("/api/auth/login", { data: { email, password: "guess-11" } });
    expect(eleventh.status()).toBe(429);
    expect(eleventh.headers()["ratelimit-policy"] ?? eleventh.headers()["ratelimit"]).toBeTruthy();
  });
});

test.describe("authorization", () => {
  test("a player can't reach what belongs to an administrator or organizer (403)", async ({ signInAs }) => {
    const page = await signInAs("player@test.com");
    const id = await publicTournamentId(page.request, "Copa Primavera 2026");

    const attempts: [string, string, object?][] = [
      ["GET", "/api/users"],
      ["GET", "/api/audit-logs"],
      ["GET", "/api/players"],
      ["GET", "/api/tournaments/mine"],
      ["POST", "/api/tournaments", { name: "Torneo pirata", startDate: "2026-12-01", endDate: "2026-12-02" }],
      ["POST", `/api/tournaments/${id}/finish`, {}],
      ["GET", `/api/tournaments/${id}/players`],
      ["PUT", "/api/dashboard/layouts/PLAYER", { widgets: [] }],
    ];
    for (const [method, path, data] of attempts) {
      const answer = await page.request.fetch(path, { method, data, headers: FROM_APP });
      // The role's refusal, not the anti-CSRF one: the request got as far as the permission check.
      expect([answer.status(), (await answer.json()).code], `${method} ${path}`).toEqual([403, "FORBIDDEN"]);
    }
  });

  test("an organizer can't promote anyone to administrator", async ({ signInAs }) => {
    const page = await signInAs("organizer@test.com");
    const me = (await (await page.request.get("/api/users/me")).json()) as { id: string };

    const answer = await page.request.patch(`/api/users/${me.id}/role`, {
      data: { role: "ADMINISTRATOR" },
      headers: FROM_APP,
    });
    expect([answer.status(), (await answer.json()).code]).toEqual([403, "FORBIDDEN"]);
  });

  test("editing one's profile can't change one's role or email (mass assignment)", async ({ signInAs }) => {
    const page = await signInAs("player@test.com");

    const edit = await page.request.put("/api/users/me", {
      headers: FROM_APP,
      data: { name: "Jugador Demo", role: "ADMINISTRATOR", roleId: 1, email: "owned@test.com", status: "ACTIVE" },
    });
    // Accepted with the extra fields ignored, or refused outright: either way, nothing changes.
    expect([200, 400]).toContain(edit.status());

    const me = (await (await page.request.get("/api/users/me")).json()) as { role: string; email: string };
    expect(me.role).toBe("PLAYER");
    expect(me.email).toBe("player@test.com");
    expect((await page.request.get("/api/users")).status()).toBe(403);
  });
});

test.describe("hostile input", () => {
  test("SQL injection in a search or a sign-in is just text: never a server error", async ({ signInAs }) => {
    const page = await signInAs("organizer@test.com");
    const PAYLOADS = ["' OR '1'='1", '\'; DROP TABLE "User"; --', '%\' UNION SELECT email, password FROM "User" --'];

    for (const q of PAYLOADS) {
      const search = await page.request.get("/api/players", { params: { q } });
      expect(search.status(), q).toBe(200);
      expect(JSON.stringify(await search.json()), q).not.toMatch(/\$2[aby]\$/); // no password hash

      const login = await page.request.post("/api/auth/login", { data: { email: q, password: q }, headers: FROM_APP });
      expect([400, 401], q).toContain(login.status());
    }
    // And the data is still there.
    expect((await page.request.get("/api/users/me")).status()).toBe(200);
  });

  test("an id that isn't a UUID, or a path that climbs out, is a 400 or 404, never a 500", async ({ signInAs }) => {
    const page = await signInAs("organizer@test.com");

    for (const path of [
      "/api/tournaments/not-a-uuid",
      "/api/tournaments/1%20OR%201=1",
      "/api/tournaments/..%2F..%2Fusers",
    ]) {
      const answer = await page.request.get(path);
      expect([400, 404], path).toContain(answer.status());
    }
  });

  test("a request body too big for the API is refused (413), and the API keeps answering", async ({ signInAs }) => {
    const page = await signInAs("player@test.com");

    const answer = await page.request.put("/api/users/me", {
      data: { name: "x".repeat(2_000_000) },
      headers: FROM_APP,
    });
    expect(answer.status()).toBe(413);
    expect((await page.request.get("/api/health")).status()).toBe(200);
  });

  test("a tournament named with HTML shows the text, and no script runs (stored XSS)", async ({ signInAs }) => {
    const page = await signInAs("organizer@test.com");
    const name = `<img src=x onerror="window.__xss=1">Torneo XSS ${Date.now()}`;
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    const created = await page.request.post("/api/tournaments", {
      headers: FROM_APP,
      data: { name, startDate: "2026-12-01", endDate: "2026-12-02" },
    });
    expect(created.status()).toBe(201);

    await page.goto("/torneos");
    await expect(page.getByText(name)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator("main img[src='x']")).toHaveCount(0);
    expect(dialogs).toEqual([]);
    // The fixture also fails the test if anything broke the Content-Security-Policy.
  });
});

test.describe("personal data (Ley 1581)", () => {
  /** Whether any answer the page received carried an email other than the user's own. */
  async function emailsSeenBy(page: Page, path: string): Promise<string[]> {
    const emails = new Set<string>();
    page.on("response", async (response) => {
      if (!response.url().includes("/api/")) return;
      const body = await response.text().catch(() => "");
      for (const email of body.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) emails.add(email);
    });
    await visit(page, path);
    await page.waitForLoadState("networkidle");
    return [...emails];
  }

  test("a visitor's public pages carry no one's email, in what the page shows or in what it downloads", async ({
    page,
  }) => {
    const id = await publicTournamentId(page.request, "Copa Primavera 2026");
    for (const path of ["/torneos-abiertos", `/sala-publica/${id}`]) {
      expect(await emailsSeenBy(page, path), path).toEqual([]);
    }
  });

  test("a player's own screens carry no other person's email", async ({ signInAs }) => {
    const page = await signInAs("player@test.com");
    const id = await publicTournamentId(page.request, "Copa Primavera 2026");

    for (const path of ["/panel", "/mis-torneos", "/en-juego", `/torneos/${id}/sala`]) {
      const others = (await emailsSeenBy(page, path)).filter((email) => email !== "player@test.com");
      expect(others, path).toEqual([]);
    }
  });
});
