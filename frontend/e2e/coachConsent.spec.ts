import { expect, test } from "./fixtures.ts";

// HU24 with the player's consent (Ley 1581): a coach asks to follow a player,
// sees nothing of their progress until the player accepts, and then does.

test("a coach follows a player only once the player accepts", async ({ signInAs }) => {
  const coach = await signInAs("marta.rios@test.com");
  await coach.goto("/mis-jugadores");
  await coach.locator("#coachPlayerQuery").fill("Laura Pineda");
  await coach
    .getByRole("listitem")
    .filter({ hasText: "Laura Pineda" })
    .getByRole("button", { name: "Solicitar" })
    .click();

  const request = coach.locator("[data-linked-player]").filter({ hasText: "Laura Pineda" });
  await expect(request).toContainText("Esperando que acepte");

  const player = await signInAs("laura.pineda@test.com");
  await player.goto("/cuenta");
  await expect(player.getByText("Marta Ríos")).toBeVisible();
  await player.getByRole("button", { name: "Aceptar a Marta Ríos" }).click();
  await expect(player.getByRole("button", { name: "Quitar a Marta Ríos" })).toBeVisible();

  await coach.reload();
  await expect(request).toBeVisible();
  await expect(request).not.toContainText("Esperando que acepte");
});
