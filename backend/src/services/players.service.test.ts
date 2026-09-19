import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { searchPlayers } from "./players.service";

function buildPrismaMock() {
  return {
    player: {
      findMany: vi.fn(),
    },
  };
}

describe("searchPlayers", () => {
  it("returns an empty list without calling the database when the text is empty", async () => {
    const prisma = buildPrismaMock();

    const result = await searchPlayers(prisma as unknown as PrismaClient, "   ");

    expect(result).toEqual([]);
    expect(prisma.player.findMany).not.toHaveBeenCalled();
  });

  it("searches by name, email or university code and maps the DTO", async () => {
    const prisma = buildPrismaMock();
    prisma.player.findMany.mockResolvedValue([
      {
        id: "player-1",
        universityCode: "U123",
        program: "Ingeniería de Sistemas",
        semester: 5,
        user: { name: "Luis Gómez", email: "luis@example.com" },
      },
    ]);

    const result = await searchPlayers(prisma as unknown as PrismaClient, "Luis");

    expect(prisma.player.findMany.mock.calls[0][0].where.OR).toHaveLength(3);
    expect(result).toEqual([
      {
        id: "player-1",
        name: "Luis Gómez",
        email: "luis@example.com",
        universityCode: "U123",
        program: "Ingeniería de Sistemas",
        semester: 5,
      },
    ]);
  });
});
