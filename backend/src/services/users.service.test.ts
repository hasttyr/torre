import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import { calculateAge } from "./user.mapper";
import { getUserById, updateOwnProfile } from "./users.service";

function buildPrismaMock() {
  return {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("getUserById", () => {
  it("includes the player profile when it exists", async () => {
    const prisma = buildPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "JUGADOR" },
      jugador: {
        codigoUniversitario: "U1",
        programa: "Sistemas",
        semestre: 5,
        fechaNacimiento: null,
        genero: null,
        discapacidad: null,
      },
    });

    const usuario = await getUserById(prisma as unknown as PrismaClient, "usuario-1");

    expect(usuario.jugador).toEqual({
      codigoUniversitario: "U1",
      programa: "Sistemas",
      semestre: 5,
      fechaNacimiento: null,
      edad: null,
      genero: null,
      discapacidad: null,
    });
  });

  it("calculates age from fechaNacimiento", async () => {
    const prisma = buildPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "JUGADOR" },
      jugador: {
        codigoUniversitario: "U1",
        programa: "Sistemas",
        semestre: 5,
        fechaNacimiento: new Date("2005-06-15"),
        genero: "MASCULINO",
        discapacidad: "NINGUNA",
      },
    });

    const usuario = await getUserById(prisma as unknown as PrismaClient, "usuario-1");

    expect(usuario.jugador?.edad).toBe(calculateAge(new Date("2005-06-15")));
    expect(usuario.jugador?.genero).toBe("MASCULINO");
    expect(usuario.jugador?.discapacidad).toBe("NINGUNA");
  });

  it("does not include jugador when the user doesn't have that profile", async () => {
    const prisma = buildPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "ORGANIZADOR" },
      jugador: null,
    });

    const usuario = await getUserById(prisma as unknown as PrismaClient, "usuario-1");

    expect(usuario.jugador).toBeUndefined();
  });
});

describe("updateOwnProfile", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("updates the name without touching the player profile when those fields aren't sent", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-1", jugador: null });
    prisma.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana T.",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "ORGANIZADOR" },
      jugador: null,
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "usuario-1", { nombre: "Ana T." });

    expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ nombre: "Ana T." });
  });

  it("updates player fields when the user has that profile", async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    });
    prisma.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "JUGADOR" },
      jugador: { codigoUniversitario: "U1", programa: "Ingeniería", semestre: 6 },
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "usuario-1", { programa: "Ingeniería", semestre: 6 });

    expect(prisma.usuario.update.mock.calls[0][0].data.jugador.update).toEqual({
      programa: "Ingeniería",
      semestre: 6,
    });
  });

  it("rejects (400) updating player fields when the user doesn't have that profile", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-1", jugador: null });

    await expect(
      updateOwnProfile(prisma as unknown as PrismaClient, "usuario-1", { programa: "Ingeniería" }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the user doesn't exist", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      updateOwnProfile(prisma as unknown as PrismaClient, "no-existe", { nombre: "X" }),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });

  it("updates fechaNacimiento, genero and discapacidad", async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    });
    prisma.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "JUGADOR" },
      jugador: {
        codigoUniversitario: "U1",
        programa: "Sistemas",
        semestre: 5,
        fechaNacimiento: new Date("2005-06-15"),
        genero: "MASCULINO",
        discapacidad: "NINGUNA",
      },
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "usuario-1", {
      fechaNacimiento: new Date("2005-06-15"),
      genero: "MASCULINO",
      discapacidad: "NINGUNA",
    });

    expect(prisma.usuario.update.mock.calls[0][0].data.jugador.update).toEqual({
      fechaNacimiento: new Date("2005-06-15"),
      genero: "MASCULINO",
      discapacidad: "NINGUNA",
    });
  });

  it("allows clearing genero/discapacidad by sending an explicit null", async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    });
    prisma.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "JUGADOR" },
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5, fechaNacimiento: null, genero: null, discapacidad: null },
    });

    await updateOwnProfile(prisma as unknown as PrismaClient, "usuario-1", { genero: null, discapacidad: null });

    expect(prisma.usuario.update.mock.calls[0][0].data.jugador.update).toEqual({ genero: null, discapacidad: null });
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
