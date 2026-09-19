import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import { loginUser, registerUser } from "./auth.service";

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

  it("creates an account with valid data for a role without an additional profile", async () => {
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
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "ORGANIZADOR",
    });

    expect(result).toEqual({
      id: "usuario-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVO",
      role: "ORGANIZADOR",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const createArgs = prisma.usuario.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe("ana@example.com");
    expect(createArgs.data.passwordHash).not.toBe("password123");
    expect(createArgs.data.jugador).toBeUndefined();
  });

  it("creates the account and the nested player profile when the role is JUGADOR", async () => {
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
      name: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      role: "JUGADOR",
      universityCode: "U12345",
      program: "Ingeniería de Sistemas",
      semester: 5,
    });

    const createArgs = prisma.usuario.create.mock.calls[0][0];
    expect(createArgs.data.jugador.create).toEqual({
      codigoUniversitario: "U12345",
      programa: "Ingeniería de Sistemas",
      semestre: 5,
    });
  });

  it("normalizes the email to lowercase and trims spaces", async () => {
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
      name: "  Ana  ",
      email: "  Ana@Example.COM  ",
      password: "password123",
      role: "ARBITRO",
    });

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
    expect(prisma.usuario.create.mock.calls[0][0].data.email).toBe("ana@example.com");
    expect(prisma.usuario.create.mock.calls[0][0].data.nombre).toBe("Ana");
  });

  it("rejects an already registered email", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-jugador", nombre: "JUGADOR" });
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-existente" });

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        name: "Duplicado",
        email: "existe@example.com",
        password: "password123",
        role: "JUGADOR",
        universityCode: "U1",
        program: "Ingeniería",
        semester: 1,
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it("rejects a role that doesn't exist in the database", async () => {
    prisma.rol.findUnique.mockResolvedValue(null);

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        name: "Alguien",
        email: "alguien@example.com",
        password: "password123",
        role: "ORGANIZADOR",
      }),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it("turns a concurrent uniqueness violation (P2002) into a 409", async () => {
    prisma.rol.findUnique.mockResolvedValue({ id: "rol-organizador", nombre: "ORGANIZADOR" });
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.create.mockRejectedValue({ code: "P2002" });

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        name: "Carrera",
        email: "carrera@example.com",
        password: "password123",
        role: "ORGANIZADOR",
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
  });
});

describe("loginUser", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("authenticates with valid credentials and returns a signed token", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-organizador", nombre: "ORGANIZADOR" },
    });

    const result = await loginUser(prisma as unknown as PrismaClient, {
      email: "ana@example.com",
      password: "password123",
    });

    expect(result.user).toEqual({
      id: "usuario-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVO",
      role: "ORGANIZADOR",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const payload = jwt.verify(result.token, "test-secret") as jwt.JwtPayload;
    expect(payload.sub).toBe("usuario-1");
    expect(payload.rol).toBe("ORGANIZADOR");
  });

  it("rejects an incorrect password with a generic message", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      email: "ana@example.com",
      estado: "ACTIVO",
      passwordHash,
      rol: { id: "rol-organizador", nombre: "ORGANIZADOR" },
    });

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "incorrecta" }),
    ).rejects.toMatchObject({ status: 401, message: "Credenciales inválidas" } satisfies Partial<HttpError>);
  });

  it("rejects a nonexistent email with the same generic message (doesn't reveal whether the account exists)", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "no-existe@example.com", password: "cualquiera" }),
    ).rejects.toMatchObject({ status: 401, message: "Credenciales inválidas" } satisfies Partial<HttpError>);
  });

  it("rejects an inactive user even when the password is correct", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      email: "ana@example.com",
      estado: "INACTIVO",
      passwordHash,
      rol: { id: "rol-organizador", nombre: "ORGANIZADOR" },
    });

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "password123" }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("normalizes the email to lowercase before looking it up", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "  Ana@Example.COM  ", password: "x" }),
    ).rejects.toBeDefined();

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: { email: "ana@example.com" },
      include: { rol: true },
    });
  });
});
