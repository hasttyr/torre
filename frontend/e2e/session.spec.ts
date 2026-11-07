import { expect, test } from "./fixtures.ts";

// The session is an HttpOnly cookie the API sets on sign-in, sent by the
// browser to /api on the app's own origin: nothing a script on the page can
// read (an XSS can't take it away), and signing out ends it on the server.

const SESSION_COOKIE = "torre_session";

test("the session is a cookie the page's scripts can't read", async ({ signInAs, request, browserName }) => {
  const page = await signInAs("organizer@test.com");

  // What the server asks for, in every browser (a sign-in of its own, with no cookie yet).
  const login = await request.post("/api/auth/login", {
    data: { email: "organizer@test.com", password: "Test1234" },
  });
  const setCookie = login
    .headersArray()
    .find(
      (header) => header.name.toLowerCase() === "set-cookie" && header.value.startsWith(`${SESSION_COOKIE}=`),
    )?.value;
  expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/SameSite=Lax/i);
  expect(setCookie).toMatch(/Path=\/api/i);

  // And what the browser kept. WebKit on Windows doesn't implement SameSite
  // (it reports every cookie as None), so there that part rests on the header.
  const session = (await page.context().cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
  const kept =
    browserName === "webkit" && process.platform === "win32"
      ? { httpOnly: true, path: "/api" }
      : { httpOnly: true, sameSite: "Lax", path: "/api" };
  expect(session).toMatchObject(kept);

  const visibleToScript = await page.evaluate(() => document.cookie + JSON.stringify({ ...localStorage }));
  expect(visibleToScript).not.toContain(session!.value);
  expect(visibleToScript).not.toContain(SESSION_COOKIE);

  // A reload keeps the user signed in: the browser still has the cookie.
  await page.reload();
  await expect(page.getByRole("button", { name: /, menú de / })).toBeVisible();
});

test("signing out ends the session on the server, not just in this browser", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");
  const context = page.context();
  const session = (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE)!;

  await page.getByRole("button", { name: /, menú de / }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain(SESSION_COOKIE);

  // Someone who copied the cookie before the sign-out can't use it.
  await context.addCookies([session]);
  const replayed = await page.request.get("/api/users/me");
  expect(replayed.status()).toBe(401);
});
