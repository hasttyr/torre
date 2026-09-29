import type { PrismaClient } from "../generated/prisma/client";
import { describe, expect, it, vi } from "vitest";

import { searchPlayers } from "./players.service";

// What a search finds, and shows, per role: privacy.int.test.ts (real database).

describe("searchPlayers", () => {
  it("returns an empty list without calling the database when the text is empty", async () => {
    const prisma = { player: { findMany: vi.fn() } };

    const result = await searchPlayers(prisma as unknown as PrismaClient, "   ", { id: "org-1", role: "ORGANIZER" });

    expect(result).toEqual([]);
    expect(prisma.player.findMany).not.toHaveBeenCalled();
  });
});
