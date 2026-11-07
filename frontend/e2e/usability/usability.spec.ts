import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test, visit } from "../fixtures.ts";

// Usability (RNF07): every screen passes the automatic WCAG 2.1 AA checks
// (axe: contrast, labels, landmarks, names of buttons and links…), a person
// can sign in with the keyboard alone, and nothing spills sideways on a
// phone. axe catches roughly half of what a person with a screen reader
// would; the rest is the UAT's (P35) and the manual's.

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** axe's findings on the page as it stands, one line each, so a failure says what and where. */
async function accessibilityViolations(page: Page): Promise<string[]> {
  // Wait for the data: a page still showing its skeleton isn't the page people use.
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help} → ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
}

/** The id of a tournament from the public listing, by its name in the seed. */
async function publicTournamentId(page: Page, name: string): Promise<string> {
  const rooms = (await (await page.request.get("/api/tournaments/public/rooms")).json()) as {
    id: string;
    name: string;
  }[];
  return rooms.find((room) => room.name === name)!.id;
}

const PUBLIC_PAGES = ["/", "/login", "/registro", "/olvide-password", "/torneos-abiertos", "/politica-de-datos"];

for (const path of PUBLIC_PAGES) {
  test(`${path} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await visit(page, path);
    expect(await accessibilityViolations(page)).toEqual([]);
  });
}

test("a finished tournament's public room has no WCAG 2.1 AA violations", async ({ page }) => {
  await page.goto(`/sala-publica/${await publicTournamentId(page, "Copa Primavera 2026")}`);
  expect(await accessibilityViolations(page)).toEqual([]);
});

// Each role's own screens, signed in as the seed's account for it.
const SIGNED_IN_PAGES = [
  { email: "admin@test.com", paths: ["/panel", "/usuarios", "/auditoria", "/cuenta"] },
  { email: "organizer@test.com", paths: ["/panel", "/torneos", "/clubes", "/torneos/nuevo"] },
  { email: "arbiter@test.com", paths: ["/panel", "/en-juego"] },
  { email: "coach@test.com", paths: ["/panel", "/mis-jugadores"] },
  { email: "player@test.com", paths: ["/panel", "/mis-torneos", "/cuenta"] },
];

for (const { email, paths } of SIGNED_IN_PAGES) {
  test(`${email}'s screens have no WCAG 2.1 AA violations`, async ({ signInAs }) => {
    const page = await signInAs(email);
    for (const path of paths) {
      await visit(page, path);
      expect(await accessibilityViolations(page), path).toEqual([]);
    }
  });
}

test("a tournament's administration and live room have no WCAG 2.1 AA violations", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");
  const id = await publicTournamentId(page, "Copa Primavera 2026");

  for (const path of [`/torneos/${id}`, `/torneos/${id}/sala`]) {
    await visit(page, path);
    expect(await accessibilityViolations(page), path).toEqual([]);
  }
});

// The theme follows the system's (index.html), and dark is the default when
// it says nothing: the contrast has to hold in both. The tests above run light.
test("the dark theme has no WCAG 2.1 AA violations either", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");
  await page.emulateMedia({ colorScheme: "dark" });
  const id = await publicTournamentId(page, "Copa Primavera 2026");

  for (const path of ["/", "/torneos-abiertos", "/panel", "/torneos", `/torneos/${id}`, `/torneos/${id}/sala`]) {
    await visit(page, path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await accessibilityViolations(page), path).toEqual([]);
  }
});

test("someone signs in with the keyboard alone", async ({ page }) => {
  await page.goto("/login");

  // From the top of the page, Tab reaches the email field: nothing traps the focus on the way.
  for (let presses = 0; presses < 20; presses += 1) {
    await page.keyboard.press("Tab");
    if (await page.locator("#email").evaluate((input) => input === document.activeElement)) break;
  }
  await expect(page.locator("#email")).toBeFocused();
  await page.keyboard.type("player@test.com");
  await page.keyboard.press("Tab");
  await expect(page.locator("#password")).toBeFocused();
  await page.keyboard.type("Test1234");
  await page.keyboard.press("Enter");

  await page.waitForURL("**/panel");
});

test("the focused element is always visible: the focus ring isn't removed", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").focus();

  const ring = await page.locator("#email").evaluate((input) => {
    const style = getComputedStyle(input);
    return { outline: style.outlineStyle, shadow: style.boxShadow };
  });
  expect(ring.outline !== "none" || ring.shadow !== "none", JSON.stringify(ring)).toBe(true);
});

// A phone held upright (iPhone SE's 375 px): nothing makes the page scroll sideways.
const PHONE = { width: 375, height: 667 };

test("public pages fit a phone's width", async ({ page }) => {
  await page.setViewportSize(PHONE);
  for (const path of ["/", "/login", "/registro", "/torneos-abiertos"]) {
    await visit(page, path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("each role's panel fits a phone's width", async ({ signInAs }) => {
  for (const email of ["admin@test.com", "organizer@test.com", "player@test.com"]) {
    const page = await signInAs(email);
    await page.setViewportSize(PHONE);
    await page.goto("/panel");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, email).toBeLessThanOrEqual(0);
  }
});

test("the interface switches to English and back, with no missing text", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "es");

  await page
    .getByRole("button", { name: /Switch to English/ })
    .first()
    .click();
  await expect(html).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Open Tournaments" }).first()).toBeVisible();
  // A missing key shows up as the key itself ("home.hero.title").
  await expect(page.locator("body")).not.toContainText(/\b[a-z]+\.[a-zA-Z]+\.[a-zA-Z]+\b/);

  await page
    .getByRole("button", { name: /Cambiar a español/ })
    .first()
    .click();
  await expect(html).toHaveAttribute("lang", "es");
  await expect(page.getByRole("link", { name: "Torneos abiertos" }).first()).toBeVisible();
});
