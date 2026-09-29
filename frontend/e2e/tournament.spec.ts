import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

// A tournament from creation to its first result, across roles: the
// organizer runs it (HU04-HU09), an arbiter records a result from another
// device (HU10), and the room follows it live (HU14/HU18). Then the official
// standings are exported (HU30).

const PLAYERS = ["Luis Gómez", "Ana Torres", "Carlos Ruiz", "María Fernanda López"];

/** Types a date the way a person does, in the picker's text field (day/month/year in Spanish). */
async function typeDate(page: Page, id: string, date: string): Promise<void> {
  const field = page.locator(`input.dp--input#${id}`);
  await field.fill(date);
  await field.press("Tab");
}

/** Answers the confirmation dialog an action opened. */
async function confirm(page: Page, label: string): Promise<void> {
  await page.getByRole("alertdialog").getByRole("button", { name: label }).click();
}

test("an organizer runs round 1, an arbiter scores a game, and the room follows it live", async ({ signInAs }) => {
  const organizer = await signInAs("organizer@test.com");

  // HU04: the tournament.
  await organizer.goto("/torneos/nuevo");
  await organizer.locator("#name").fill(`Copa E2E ${Date.now()}`);
  await typeDate(organizer, "startDate", "01/12/2026");
  await typeDate(organizer, "endDate", "03/12/2026");
  await organizer.getByRole("button", { name: "Crear torneo" }).click();
  await organizer.waitForURL(/\/torneos\/[0-9a-f-]{36}$/);
  const tournamentPath = new URL(organizer.url()).pathname;

  // HU05-HU07: three rounds, registration open, four players in, registration closed.
  await organizer.locator("#roundsCount").fill("3");
  await organizer.getByRole("button", { name: "Guardar configuración" }).click();
  await organizer.getByRole("button", { name: "Abrir inscripciones" }).click();
  for (const player of PLAYERS) {
    await organizer.locator("#playerQuery").fill(player);
    await organizer
      .getByRole("listitem")
      .filter({ hasText: player })
      .getByRole("button", { name: "Inscribir" })
      .click();
    await expect(organizer.getByRole("table")).toContainText(player);
  }
  await organizer.getByRole("button", { name: "Cerrar inscripciones" }).click();
  await confirm(organizer, "Cerrar inscripciones");

  // HU08/HU09: round 1, reviewed as a draft, then published.
  await organizer.getByRole("button", { name: "Generar ronda 1" }).click();
  await organizer.getByRole("button", { name: "Publicar ronda 1" }).click();
  await confirm(organizer, "Publicar");
  await organizer.getByRole("link", { name: "Abrir sala del torneo" }).click();
  await organizer.waitForURL(`**${tournamentPath}/sala`);

  // HU10, from the arbiter's own device; HU14: the organizer's room shows it without reloading.
  const arbiter = await signInAs("arbiter@test.com");
  await arbiter.goto(`${tournamentPath}/sala`);
  await arbiter
    .getByRole("group", { name: "Resultado" })
    .first()
    .getByRole("button", { name: "Ganan blancas" })
    .click();
  await expect(arbiter.getByText("1 – 0").first()).toBeVisible();

  // The organizer's room was open before the result existed: only the live channel can bring it.
  await expect(organizer.getByText("1 – 0").first()).toBeVisible();
  await expect(organizer.getByRole("button", { name: "Corregir" }).first()).toBeVisible();

  // HU30: the official standings, as a PDF.
  const [download] = await Promise.all([
    organizer.waitForEvent("download"),
    organizer.getByRole("button", { name: "Clasificación (PDF)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
