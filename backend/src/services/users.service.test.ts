import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import { calculateAge } from "./user.mapper";
import { getUserById, updateOwnProfile } from "./users.service";

function buildPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("getUserById", () => {
  it("includes the player profile when it exists", async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "PLAYER" },
      player: {
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
        birthDate: null,
        gender: null,
        disability: null,
      },
    });

    const user = await getUserById(prisma as unknown as PrismaClient, "user-1");

    expect(user.player).toEqual({
      universityCode: "U1",
      program: "Sistemas",
      semester: 5,
      birthDate: null,
      age: null,
      gender: null,
      disability: null,
      club: null,
    });
  });

  it("calculates age from birthDate", async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "PLAYER" },
      player: {
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
        birthDate: new Date("2005-06-15"),
        gender: "MALE",
        disability: "NONE",
      },
    });

    const user = await getUserById(prisma as unknown as PrismaClient, "user-1");

    expect(user.player?.age).toBe(calculateAge(new Date("2005-06-15")));
    expect(user.player?.gender).toBe("MALE");
    expect(user.player?.disability).toBe("NONE");
  });

  it("does not include player when the user doesn't have that profile", async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "ORGANIZER" },
      player: null,
    });

    const user = await getUserById(prisma as unknown as PrismaClient, "user-1");

    expect(user.player).toBeUndefined();
  });
});

describe("updateOwnProfile", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("updates the name without touching the player profile when those fields aren't sent", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", player: null });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Ana T.",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "ORGANIZER" },
      player: null,
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "user-1", { name: "Ana T." });

    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ name: "Ana T." });
  });

  it("updates player fields when the user has that profile", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      player: { universityCode: "U1", program: "Sistemas", semester: 5 },
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "PLAYER" },
      player: { universityCode: "U1", program: "Ingeniería", semester: 6 },
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "user-1", { program: "Ingeniería", semester: 6 });

    expect(prisma.user.update.mock.calls[0][0].data.player.update).toEqual({
      program: "Ingeniería",
      semester: 6,
    });
  });

  it("rejects (400) updating player fields when the user doesn't have that profile", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", player: null });

    await expect(
      updateOwnProfile(prisma as unknown as PrismaClient, "user-1", { program: "Ingeniería" }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the user doesn't exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(updateOwnProfile(prisma as unknown as PrismaClient, "no-existe", { name: "X" })).rejects.toMatchObject(
      { status: 404 } satisfies Partial<HttpError>,
    );
  });

  it("updates birthDate, gender and disability", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      player: { universityCode: "U1", program: "Sistemas", semester: 5 },
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "PLAYER" },
      player: {
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
        birthDate: new Date("2005-06-15"),
        gender: "MALE",
        disability: "NONE",
      },
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "user-1", {
      birthDate: new Date("2005-06-15"),
      gender: "MALE",
      disability: "NONE",
    });

    expect(prisma.user.update.mock.calls[0][0].data.player.update).toEqual({
      birthDate: new Date("2005-06-15"),
      gender: "MALE",
      disability: "NONE",
    });
  });

  it("allows clearing gender/disability by sending an explicit null", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      player: { universityCode: "U1", program: "Sistemas", semester: 5 },
    });
    prisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01"),
      role: { name: "PLAYER" },
      player: {
        universityCode: "U1",
        program: "Sistemas",
        semester: 5,
        birthDate: null,
        gender: null,
        disability: null,
      },
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "user-1", { gender: null, disability: null });

    expect(prisma.user.update.mock.calls[0][0].data.player.update).toEqual({ gender: null, disability: null });
  });
});

describe("calculateAge", () => {
  it("calculates age when the birthday has already passed this year", () => {
    expect(calculateAge(new Date("2000-01-01"), new Date("2026-06-01"))).toBe(26);
  });

  it("doesn't add the year yet if the birthday hasn't arrived", () => {
    expect(calculateAge(new Date("2000-12-31"), new Date("2026-06-01"))).toBe(25);
  });

  it("correctly calculates the exact birthday date", () => {
    expect(calculateAge(new Date("2000-06-01"), new Date("2026-06-01"))).toBe(26);
  });
});
