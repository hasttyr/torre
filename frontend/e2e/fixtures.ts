import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

// What every browser test shares: signing in as one of the seeded accounts
// (backend/prisma/seed.ts), each in its own browser context, and a check
// that no page broke the Content-Security-Policy vercel.json enforces.

/** The seed's password for every demo account. */
const PASSWORD = "Test1234";

/** Records every Content-Security-Policy violation in the context's pages, as they happen. */
async function recordCspViolations(context: BrowserContext, violations: string[]): Promise<void> {
  await context.exposeBinding("reportCspViolation", (_source, report: string) => {
    violations.push(report);
  });
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = `${event.effectiveDirective} blocked ${event.blockedURI || "inline code"}`;
      (window as unknown as { reportCspViolation(report: string): void }).reportCspViolation(report);
    });
  });
}

interface Fixtures {
  /** A page signed in as `email`, in a browser context of its own (as another device would be). */
  signInAs(email: string): Promise<Page>;
}

export const test = base.extend<Fixtures>({
  signInAs: async ({ browser }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const violations: string[] = [];

    await use(async (email) => {
      const context = await browser.newContext(testInfo.project.use);
      contexts.push(context);
      await recordCspViolations(context, violations);
      const page = await context.newPage();
      await page.goto("/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(PASSWORD);
      await page.getByRole("button", { name: "Ingresar" }).click();
      await page.waitForURL("**/panel");
      return page;
    });

    await Promise.all(contexts.map((context) => context.close()));
    expect(violations, "a page broke the Content-Security-Policy").toEqual([]);
  },
});

export { expect };
