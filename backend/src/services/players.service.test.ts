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

  // A coach is a self-service account: fragments ("a", "2026") would hand
  // them the whole directory ten players at a time.
  it("matches a coach's search only against a whole name, email or university code", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await searchPlayers({ player: { findMany } } as unknown as PrismaClient, " Laura Pérez ", {
      id: "coach-1",
      role: "COACH",
    });

    expect(findMany.mock.calls[0]![0].where.OR).toEqual([
      { user: { name: { equals: "Laura Pérez", mode: "insensitive" } } },
      { user: { email: { equals: "Laura Pérez", mode: "insensitive" } } },
      { universityCode: { equals: "Laura Pérez", mode: "insensitive" } },
    ]);
  });

  it("still lets whoever runs tournaments and clubs search by any fragment", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    await searchPlayers({ player: { findMany } } as unknown as PrismaClient, "lau", { id: "org-1", role: "ORGANIZER" });

    expect(findMany.mock.calls[0]![0].where.OR).toEqual([
      { user: { name: { contains: "lau", mode: "insensitive" } } },
      { user: { email: { contains: "lau", mode: "insensitive" } } },
      { universityCode: { contains: "lau", mode: "insensitive" } },
    ]);
  });
});
