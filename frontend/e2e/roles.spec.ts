import { expect, test } from "./fixtures.ts";

// Every role signs in and finds its own navigation (RF03).
const ROLES = [
  { email: "admin@test.com", links: ["Panel", "Usuarios", "Auditoría"] },
  { email: "organizer@test.com", links: ["Panel", "Mis torneos", "Clubes"] },
  { email: "arbiter@test.com", links: ["Panel", "En juego"] },
  { email: "coach@test.com", links: ["Panel", "Mis jugadores", "En juego"] },
  { email: "player@test.com", links: ["Panel", "Torneos", "En juego"] },
];

for (const { email, links } of ROLES) {
  test(`${email} signs in to the panel, with their role's links`, async ({ signInAs }) => {
    const page = await signInAs(email);

    const nav = page.getByRole("navigation").first();
    for (const link of links) await expect(nav.getByRole("link", { name: link, exact: true })).toBeVisible();
  });
}
