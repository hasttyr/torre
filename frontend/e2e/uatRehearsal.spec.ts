import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures.ts";

// The technical rehearsal of the UAT (#131, docs/runbooks/ensayo-uat.md): a
// tournament day with its incidents, across roles, before real people run
// it. A late arrival after registration closed (#133), a player who enrolls
// themselves (#135), a player who doesn't show up (#136), an end date that
// has to move (#125), and the hallway test: each player finds their game
// on their own (#134).

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

/** The organizer enrolls a player found by name (HU07). */
async function enroll(organizer: Page, name: string): Promise<void> {
  await organizer.locator("#playerQuery").fill(name);
  await organizer.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Inscribir" }).click();
  await expect(organizer.getByRole("table")).toContainText(name);
}

test("a tournament day with its incidents runs end to end", async ({ signInAs }) => {
  test.slow();
  const name = `Ensayo UAT ${Date.now()}`;
  const organizer = await signInAs("organizer@test.com");

  // A tournament with a generous end date: the automatic close (decision 010)
  // can't fall in the middle of the rehearsal.
  await organizer.goto("/torneos/nuevo");
  await organizer.locator("#name").fill(name);
  await typeDate(organizer, "startDate", "01/12/2026");
  await typeDate(organizer, "endDate", "03/12/2026");
  await organizer.getByRole("button", { name: "Crear torneo" }).click();
  await organizer.waitForURL(/\/torneos\/[0-9a-f-]{36}$/);
  const tournamentPath = new URL(organizer.url()).pathname;
  await organizer.locator("#roundsCount").fill("2");
  await organizer.getByRole("button", { name: "Guardar configuración" }).click();
  await organizer.getByRole("button", { name: "Abrir inscripciones", exact: true }).click();

  // A student enrolls from their own phone.
  const student = await signInAs("player@test.com");
  await student.goto("/mis-torneos");
  await student
    .locator("main section")
    .nth(1)
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("button", { name: "Inscribirme" })
    .click();
  await expect(student.locator("main section").first()).toContainText(name);

  // The organizer enrolls the rest, and closes registration.
  await organizer.reload();
  await expect(organizer.getByRole("table")).toContainText("Jugador Demo");
  for (const player of ["Luis Gómez", "Ana Torres"]) await enroll(organizer, player);
  await organizer.getByRole("button", { name: "Cerrar inscripciones" }).click();
  await confirm(organizer, "Cerrar inscripciones");

  // Incident: someone arrives after registration closed, before round 1.
  await organizer.getByRole("button", { name: "Reabrir inscripciones" }).click();
  await confirm(organizer, "Reabrir inscripciones");
  await enroll(organizer, "Carlos Ruiz");
  await organizer.getByRole("button", { name: "Cerrar inscripciones" }).click();
  await confirm(organizer, "Cerrar inscripciones");

  // Round 1, with the four of them.
  await organizer.getByRole("button", { name: "Generar ronda 1" }).click();
  await organizer.getByRole("button", { name: "Publicar ronda 1" }).click();
  await confirm(organizer, "Publicar");
  await expect(organizer.getByRole("button", { name: "Publicar ronda 1" })).toBeHidden();

  // The hallway test: the student finds their board without help.
  await student.goto(`${tournamentPath}/sala`);
  await expect(student.locator("[data-test='my-board']")).toContainText("Ronda 1");
  await expect(student.locator("[data-test='my-board']")).toContainText(/Mesa \d · (blancas|negras) contra /);

  // Incident: a player doesn't show up. The arbiter records the forfeit.
  const arbiter = await signInAs("arbiter@test.com");
  await arbiter.goto(`${tournamentPath}/sala`);
  await arbiter
    .getByRole("group", { name: "Incomparecencia" })
    .first()
    .getByRole("button", { name: "No se presentaron las negras" })
    .click();
  await expect(arbiter.getByText("1F – 0F").first()).toBeVisible();
  // The student's room, open before it, follows it live.
  await expect(student.getByText("1F – 0F").first()).toBeVisible();

  // Incident: the day runs long. The organizer extends the end date.
  await organizer.goto(tournamentPath);
  await typeDate(organizer, "configEndDate", "10/12/2026");
  await organizer.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(organizer.getByRole("status").filter({ hasText: "Configuración guardada" })).toBeVisible();
  await organizer.reload();
  await expect(organizer.locator("input.dp--input#configEndDate")).toHaveValue("10/12/2026");
});
