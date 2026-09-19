import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
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
  it("incluye el perfil de jugador cuando existe", async () => {
    const prisma = buildPrismaMock();
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01"),
      rol: { nombre: "JUGADOR" },
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    });

    const usuario = await getUserById(prisma as unknown as PrismaClient, "usuario-1");

    expect(usuario.jugador).toEqual({ codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 });
  });

  it("no incluye jugador cuando el usuario no tiene ese perfil", async () => {
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

  it("actualiza el nombre sin tocar el perfil de jugador si no se envían esos campos", async () => {
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

  it("actualiza los campos de jugador cuando el usuario tiene ese perfil", async () => {
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

  it("rechaza (400) actualizar campos de jugador si el usuario no tiene ese perfil", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-1", jugador: null });

    await expect(
      updateOwnProfile(prisma as unknown as PrismaClient, "usuario-1", { programa: "Ingeniería" }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el usuario no existe", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      updateOwnProfile(prisma as unknown as PrismaClient, "no-existe", { nombre: "X" }),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HttpError>);
  });
});
