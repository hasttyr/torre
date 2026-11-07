import { expect, test } from "../fixtures.ts";

// Smoke (cordura): the handful of checks that say a build is alive and worth
// testing further, in well under a minute. If one fails, the rest of the
// suites would only fail with it. Also the compatibility suite's core: it
// runs again in Firefox, WebKit and on phones (playwright.config.ts).

test("the API answers through the app's own origin", async ({ request }) => {
  const health = await request.get("/api/health");

  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
});

test("the home page loads, with no errors in the console", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("link", { name: "Torneos abiertos" }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("someone signs in and reaches their panel", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("button", { name: /, menú de / })).toBeVisible();
});

test("a wrong password is refused, with a message and without signing in", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill("organizer@test.com");
  await page.locator("#password").fill("not-the-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a page that needs a session sends a visitor to sign in", async ({ page }) => {
  await page.goto("/panel");

  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test("an address that doesn't exist shows the not-found page, not a blank one", async ({ page }) => {
  await page.goto("/no-existe");

  await expect(page.locator("main")).not.toBeEmpty();
  await expect(page.getByRole("link").first()).toBeVisible();
});
