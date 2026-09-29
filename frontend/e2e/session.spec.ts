import { expect, test } from "./fixtures.ts";

// The session is an HttpOnly cookie the API sets on sign-in, sent by the
// browser to /api on the app's own origin: nothing a script on the page can
// read (an XSS can't take it away), and signing out ends it on the server.

const SESSION_COOKIE = "torre_session";

test("the session is a cookie the page's scripts can't read", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");

  const session = (await page.context().cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/api" });

  const visibleToScript = await page.evaluate(() => document.cookie + JSON.stringify({ ...localStorage }));
  expect(visibleToScript).not.toContain(session!.value);
  expect(visibleToScript).not.toContain(SESSION_COOKIE);

  // A reload keeps the user signed in: the browser still has the cookie.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Menú de / })).toBeVisible();
});

test("signing out ends the session on the server, not just in this browser", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");
  const context = page.context();
  const session = (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE)!;

  await page.getByRole("button", { name: /^Menú de / }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain(SESSION_COOKIE);

  // Someone who copied the cookie before the sign-out can't use it.
  await context.addCookies([session]);
  const replayed = await page.request.get("/api/users/me");
  expect(replayed.status()).toBe(401);
});
