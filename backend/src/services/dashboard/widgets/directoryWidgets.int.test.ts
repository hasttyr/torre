import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../../config/prisma";
import { createTournament, createUser, resetDatabase } from "../../../testing/testDatabase";
import { loadPlayersOverview } from "./directoryWidgets";

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Ana beat Luis on board 1 of a published round; Marta played nobody. */
async function oneGamePlayed() {
  const organizer = await createUser(prisma, "ORGANIZER");
  const ana = await createUser(prisma, "PLAYER", { name: "Ana Torres" });
  const luis = await createUser(prisma, "PLAYER", { name: "Luis Gómez" });
  const marta = await createUser(prisma, "PLAYER", { name: "Marta Díaz" });
  const tournament = await createTournament(prisma, organizer, { status: "IN_PROGRESS", players: [ana, luis, marta] });
  await prisma.round.create({
    data: {
      tournamentId: tournament.id,
      number: 1,
      status: "RECORDING_RESULTS",
      matches: {
        create: { board: 1, whiteId: ana.playerId, blackId: luis.playerId, result: { create: { value: "1-0" } } },
      },
    },
  });
  return { organizer, ana, luis };
}

// Against the real database: the filter on whose games to count is Prisma's
// to translate, and a mock would accept any filter.
describe("PLAYERS_OVERVIEW", () => {
  it("counts every player's games for a viewer who sees everyone", async () => {
    const { organizer } = await oneGamePlayed();

    const rows = await loadPlayersOverview(prisma, { id: organizer.id, role: "ORGANIZER" });

    expect(rows.map(({ name, wins, losses, games }) => ({ name, wins, losses, games }))).toEqual([
      { name: "Ana Torres", wins: 1, losses: 0, games: 1 },
      { name: "Luis Gómez", wins: 0, losses: 1, games: 1 },
      { name: "Marta Díaz", wins: 0, losses: 0, games: 0 },
    ]);
  });

  it("counts only the coach's own players, games against anyone included", async () => {
    const { luis } = await oneGamePlayed();
    const coach = await createUser(prisma, "COACH");
    await prisma.coachPlayer.create({ data: { coachId: coach.id, playerId: luis.playerId!, acceptedAt: new Date() } });

    const rows = await loadPlayersOverview(prisma, { id: coach.id, role: "COACH" });

    expect(rows).toEqual([expect.objectContaining({ name: "Luis Gómez", losses: 1, games: 1 })]);
  });
});
