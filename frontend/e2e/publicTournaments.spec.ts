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

// #140: the read-only room of a tournament already played, for anyone, by name
// only (the seed's finished "Copa Primavera 2026").
test("a visitor follows a finished tournament's public room, which shows names and results only", async ({ page }) => {
  await page.goto("/torneos-abiertos");
  await page.getByRole("link", { name: /Copa Primavera 2026/ }).click();

  await expect(page).toHaveURL(/\/sala-publica\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Copa Primavera 2026" })).toBeVisible();
  await expect(page.getByText("Torneo terminado")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Ronda 5" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await expect(page.locator("main")).not.toContainText("@test.com");
});
