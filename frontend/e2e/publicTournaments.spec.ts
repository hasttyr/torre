import { expect, test } from "./fixtures.ts";

// HU25 / RF17: a visitor who never signed in finds the tournaments open for
// registration (the seed's "Copa Central de Apertura"), and how to join.

test("a visitor sees the tournaments open for registration, without signing in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Torneos abiertos" }).first().click();

  await expect(page).toHaveURL(/\/torneos-abiertos$/);
  await expect(page.getByRole("heading", { level: 2, name: "Copa Central de Apertura" })).toBeVisible();
  // Nothing about the people in it: the organizer's name included.
  await expect(page.locator("main")).not.toContainText("Organizador");
  await expect(page.locator("main").getByRole("link", { name: "Crear cuenta" })).toBeVisible();
});
