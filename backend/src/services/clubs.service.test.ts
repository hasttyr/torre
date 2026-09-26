import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignPlayerToClub,
  createClub,
  deleteClub,
  listClubPlayers,
  removePlayerFromClub,
  updateClub,
} from "./clubs.service";

function buildPrismaMock() {
  return {
    club: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    player: { count: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  };
}

type PrismaMock = ReturnType<typeof buildPrismaMock>;
const asClient = (prisma: PrismaMock) => prisma as unknown as PrismaClient;
const CLUB = { id: "c-1", name: "Torre Blanca", createdAt: new Date("2026-01-01") };
const PLAYER = {
  id: "p-1",
  clubId: null,
  universityCode: "U1",
  program: "Sistemas",
  semester: 3,
  user: { name: "Ana" },
};

describe("clubs.service (HU23)", () => {
  let prisma: PrismaMock;
  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("creates a club with a trimmed name", async () => {
    prisma.club.create.mockResolvedValue(CLUB);

    await expect(createClub(asClient(prisma), { name: "  Torre Blanca " })).resolves.toEqual(CLUB);
    expect(prisma.club.create).toHaveBeenCalledWith({ data: { name: "Torre Blanca" } });
  });

  it("reports a duplicated name as a conflict, on create and on rename", async () => {
    prisma.club.create.mockRejectedValue({ code: "P2002" });
    prisma.club.findUnique.mockResolvedValue(CLUB);
    prisma.club.update.mockRejectedValue({ code: "P2002" });

    await expect(createClub(asClient(prisma), { name: "Torre Blanca" })).rejects.toMatchObject({ status: 409 });
    await expect(updateClub(asClient(prisma), "c-1", { name: "Otro" })).rejects.toMatchObject({ status: 409 });
  });

  it("lets other database errors through untouched", async () => {
    prisma.club.create.mockRejectedValue(new Error("db down"));

    await expect(createClub(asClient(prisma), { name: "X" })).rejects.toThrow("db down");
  });

  it("renames an existing club, and 404s an unknown one", async () => {
    prisma.club.findUnique.mockResolvedValueOnce(CLUB).mockResolvedValueOnce(null);
    prisma.club.update.mockResolvedValue({ ...CLUB, name: "Nuevo" });

    await expect(updateClub(asClient(prisma), "c-1", { name: "Nuevo" })).resolves.toMatchObject({ name: "Nuevo" });
    await expect(updateClub(asClient(prisma), "nope", { name: "Nuevo" })).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to delete a club that still has players, and deletes an empty one", async () => {
    prisma.club.findUnique.mockResolvedValue(CLUB);
    prisma.player.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

    await expect(deleteClub(asClient(prisma), "c-1")).rejects.toMatchObject({ status: 409 });
    await deleteClub(asClient(prisma), "c-1");
    expect(prisma.club.delete).toHaveBeenCalledTimes(1);
  });

  it("404s deleting an unknown club", async () => {
    prisma.club.findUnique.mockResolvedValue(null);

    await expect(deleteClub(asClient(prisma), "nope")).rejects.toMatchObject({ status: 404 });
  });

  it("assigns a player to a club and returns their profile", async () => {
    prisma.club.findUnique.mockResolvedValue(CLUB);
    prisma.player.findUnique.mockResolvedValue(PLAYER);
    prisma.player.update.mockResolvedValue({ ...PLAYER, clubId: "c-1" });

    await expect(assignPlayerToClub(asClient(prisma), "c-1", { playerId: "p-1" })).resolves.toEqual({
      playerId: "p-1",
      name: "Ana",
      universityCode: "U1",
      program: "Sistemas",
      semester: 3,
    });
  });

  it("404s assigning to an unknown club or an unknown player", async () => {
    prisma.club.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(CLUB);
    prisma.player.findUnique.mockResolvedValue(null);

    await expect(assignPlayerToClub(asClient(prisma), "nope", { playerId: "p-1" })).rejects.toMatchObject({
      status: 404,
    });
    await expect(assignPlayerToClub(asClient(prisma), "c-1", { playerId: "nope" })).rejects.toMatchObject({
      status: 404,
    });
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it("only removes a player from the club they actually belong to", async () => {
    prisma.player.findUnique
      .mockResolvedValueOnce({ ...PLAYER, clubId: "other" })
      .mockResolvedValueOnce({ ...PLAYER, clubId: "c-1" });

    await expect(removePlayerFromClub(asClient(prisma), "c-1", "p-1")).rejects.toMatchObject({ status: 404 });
    await removePlayerFromClub(asClient(prisma), "c-1", "p-1");
    expect(prisma.player.update).toHaveBeenCalledWith({ where: { id: "p-1" }, data: { clubId: null } });
  });

  it("lists a club's players, and 404s an unknown club", async () => {
    prisma.club.findUnique.mockResolvedValueOnce(CLUB).mockResolvedValueOnce(null);
    prisma.player.findMany.mockResolvedValue([PLAYER]);

    await expect(listClubPlayers(asClient(prisma), "c-1")).resolves.toHaveLength(1);
    await expect(listClubPlayers(asClient(prisma), "nope")).rejects.toMatchObject({ status: 404 });
  });
});
