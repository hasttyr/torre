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
  // them the whole directory ten players at a time. Which names match the
  // words (case, accents, whole words) is up to the database: privacy.int.test.ts.
  it("matches a coach's search against the players named by those words, or a whole email or university code", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const $queryRaw = vi.fn().mockResolvedValue([{ id: "player-1" }]);

    await searchPlayers({ player: { findMany }, $queryRaw } as unknown as PrismaClient, " Laura  Pérez ", {
      id: "coach-1",
      role: "COACH",
    });

    expect($queryRaw.mock.calls[0]!.slice(1)).toEqual([["Laura", "Pérez"]]);
    expect(findMany.mock.calls[0]![0].where.OR).toEqual([
      { id: { in: ["player-1"] } },
      { user: { email: { equals: "Laura  Pérez", mode: "insensitive" } } },
      { universityCode: { equals: "Laura  Pérez", mode: "insensitive" } },
    ]);
  });

  it("doesn't look names up for a coach who typed a single word", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const $queryRaw = vi.fn();

    await searchPlayers({ player: { findMany }, $queryRaw } as unknown as PrismaClient, "Laura", {
      id: "coach-1",
      role: "COACH",
    });

    expect($queryRaw).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0]![0].where.OR[0]).toEqual({ id: { in: [] } });
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
