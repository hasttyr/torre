import { expect, test } from "./fixtures.ts";

// HU25: a player joins a tournament with registration open by themselves
// (the seed's "Copa Central de Apertura"), and its organizer finds them on
// the roster, as if they had enrolled them (HU07).

const TOURNAMENT = "Copa Central de Apertura";

test("a player enrolls in an open tournament, and its organizer sees them on the roster", async ({ signInAs }) => {
  const player = await signInAs("player@test.com");
  await player.goto("/mis-torneos");
  // The page's two sections: the player's registrations, then the tournaments open to join.
  const [mine, available] = [player.locator("main section").nth(0), player.locator("main section").nth(1)];
  const card = available.getByRole("listitem").filter({ hasText: TOURNAMENT });
  await card.getByRole("button", { name: "Inscribirme" }).click();

  await expect(card.getByRole("button", { name: "Cancelar inscripción" })).toBeVisible();
  await expect(mine).toContainText(TOURNAMENT);

  const organizer = await signInAs("organizer@test.com");
  await organizer.goto("/torneos");
  await organizer.getByRole("link", { name: TOURNAMENT }).first().click();
  await expect(organizer.getByRole("table")).toContainText("Jugador Demo");
});
