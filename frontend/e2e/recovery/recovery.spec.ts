import { expect, test } from "../fixtures.ts";

// Recovery, in the browser: the API or the network drops out for a while (a
// Render restart, the campus Wi-Fi) and comes back. The app says what failed
// instead of showing a blank or stale page, and once the API is back it
// carries on without the person having to sign in again. The API's own side
// (a crash, the database dropping out) is backend/src/testing/recovery.ts.

test("a page whose data can't load says so, and loads it on retry once the API is back", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));

  await page.getByRole("link", { name: "Torneos abiertos" }).first().click();
  const failure = page.getByRole("alert");
  await expect(failure).toBeVisible();

  await page.unroute("**/api/**");
  await failure.getByRole("button", { name: "Reintentar" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Copa Central de Apertura" })).toBeVisible();
  await expect(failure).toBeHidden();
});

test("the API answering 503 for a while (a restart) is shown as a failure, not as empty data", async ({ page }) => {
  await page.route("**/api/tournaments/public**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "down" }) }),
  );
  await page.goto("/torneos-abiertos");

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Copa Central de Apertura" })).toHaveCount(0);

  await page.unroute("**/api/tournaments/public**");
  await page.getByRole("alert").getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Copa Central de Apertura" })).toBeVisible();
});

test("a signed-in person who loses the connection is still signed in when it comes back", async ({ signInAs }) => {
  const page = await signInAs("organizer@test.com");
  const context = page.context();

  await context.setOffline(true);
  await page.getByRole("navigation").first().getByRole("link", { name: "Clubes", exact: true }).click();
  await page.waitForTimeout(1_000);
  await context.setOffline(false);

  // Back online: a reload finds the session where it was, with no new sign-in.
  await page.goto("/clubes");
  await expect(page).toHaveURL(/\/clubes$/);
  await expect(page.getByRole("button", { name: /, menú de / })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("the live room reconnects after the network drops, and shows a change made meanwhile", async ({ signInAs }) => {
  const viewer = await signInAs("player@test.com");
  const rooms = (await (await viewer.request.get("/api/tournaments/live")).json()) as { id: string; name: string }[];
  const live = rooms.find((room) => room.name === "Liga Universitaria 2026-II");
  test.skip(!live, "the seed has no tournament in progress");

  await viewer.goto(`/torneos/${live!.id}/sala`);
  await expect(viewer.getByRole("heading", { level: 1, name: "Liga Universitaria 2026-II" })).toBeVisible();

  await viewer.context().setOffline(true);
  await viewer.waitForTimeout(3_000);
  await viewer.context().setOffline(false);

  // Whatever the socket missed, a reload (or its reconnection) brings the room up to date.
  await viewer.reload();
  await expect(viewer.getByRole("heading", { level: 1, name: "Liga Universitaria 2026-II" })).toBeVisible();
  await expect(viewer.getByRole("alert")).toHaveCount(0);
});
