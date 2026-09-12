import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import { registerUser } from "./auth.service";

function buildPrismaMock() {
  return {
    rol: {
      findUnique: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
}

describe("registerUser", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("crea una cuenta con datos válidos para un rol sin perfil adicional", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-organizador", nombre: "ORGANIZADOR" });
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-organizador", nombre: "ORGANIZADOR" },
    });

    const result = await registerUser(prisma as unknown as PrismaClient, {
      nombre: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      rol: "ORGANIZADOR",
    });

    expect(result).toEqual({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      rol: "ORGANIZADOR",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const createArgs = prisma.usuario.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe("ana@example.com");
    expect(createArgs.data.passwordHash).not.toBe("password123");
    expect(createArgs.data.jugador).toBeUndefined();
  });

  it("crea la cuenta y el perfil de jugador anidado cuando rol es JUGADOR", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-jugador", nombre: "JUGADOR" });
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: "usuario-2",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      rol: { id: "rol-jugador", nombre: "JUGADOR" },
    });

    await registerUser(prisma as unknown as PrismaClient, {
      nombre: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      rol: "JUGADOR",
      codigoUniversitario: "U12345",
      programa: "Ingeniería de Sistemas",
      semestre: 5,
    });

    const createArgs = prisma.usuario.create.mock.calls[0][0];
    expect(createArgs.data.jugador.create).toEqual({
      codigoUniversitario: "U12345",
      programa: "Ingeniería de Sistemas",
      semestre: 5,
    });
  });

  it("normaliza el correo a minúsculas y sin espacios", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-arbitro", nombre: "ARBITRO" });
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: "usuario-3",
      nombre: "Ana",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date(),
      rol: { id: "rol-arbitro", nombre: "ARBITRO" },
    });

    await registerUser(prisma as unknown as PrismaClient, {
      nombre: "  Ana  ",
      email: "  Ana@Example.COM  ",
      password: "password123",
      rol: "ARBITRO",
    });

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
    expect(prisma.usuario.create.mock.calls[0][0].data.email).toBe("ana@example.com");
    expect(prisma.usuario.create.mock.calls[0][0].data.nombre).toBe("Ana");
  });

  it("rechaza un correo ya registrado", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-jugador", nombre: "JUGADOR" });
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-existente" });

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        nombre: "Duplicado",
        email: "existe@example.com",
        password: "password123",
        rol: "JUGADOR",
        codigoUniversitario: "U1",
        programa: "Ingeniería",
        semestre: 1,
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it("rechaza un rol que no existe en la base de datos", async () => {
    prisma.rol.findUnique.mockResolvedValue(null);

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        nombre: "Alguien",
        email: "alguien@example.com",
        password: "password123",
        rol: "ORGANIZADOR",
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it("convierte una violación de unicidad concurrente (P2002) en 409", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-organizador", nombre: "ORGANIZADOR" });
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockRejectedValue({ code: "P2002" });

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        nombre: "Carrera",
        email: "carrera@example.com",
        password: "password123",
        rol: "ORGANIZADOR",
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });
});
