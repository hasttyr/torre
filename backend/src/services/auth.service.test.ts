import type { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpError } from "../errors/apiErrors";
import { loginUser, registerUser } from "./auth.service";
import { comparePassword, hashPassword } from "./password";

// The real hashing, observed: login must do the same password work whether
// or not the account exists.
vi.mock("./password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./password")>();
  return { ...actual, comparePassword: vi.fn(actual.comparePassword) };
});

function buildPrismaMock() {
  return {
    role: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("registerUser", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("creates an account with valid data for a role without an additional profile", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "role-organizer", name: "ORGANIZER" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-organizer", name: "ORGANIZER" },
      dataPolicyAccepted: true,
      dataPolicyAcceptedAt: new Date("2026-01-01T00:00:00Z"),
      dataPolicyVersion: "2026-08-01",
    });

    const result = await registerUser(prisma as unknown as PrismaClient, {
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "COACH",
      acceptDataPolicy: true,
    });

    expect(result).toEqual({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      role: "ORGANIZER",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      dataConsent: {
        accepted: true,
        date: new Date("2026-01-01T00:00:00Z"),
        version: "2026-08-01",
      },
    });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.email).toBe("ana@example.com");
    expect(createArgs.data.passwordHash).not.toBe("password123");
    expect(createArgs.data.player).toBeUndefined();
    expect(createArgs.data.dataPolicyAccepted).toBe(true);
    expect(createArgs.data.dataPolicyVersion).toBe("2026-08-01");
  });

  it("creates the account and the nested player profile when the role is PLAYER", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "role-player", name: "PLAYER" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-2",
      name: "Luis Gómez",
      email: "luis@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      role: { id: "role-player", name: "PLAYER" },
    });

    await registerUser(prisma as unknown as PrismaClient, {
      name: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      role: "PLAYER",
      universityCode: "U12345",
      program: "Ingeniería de Sistemas",
      semester: 5,
      acceptDataPolicy: true,
    });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.player.create).toEqual({
      universityCode: "U12345",
      program: "Ingeniería de Sistemas",
      semester: 5,
    });
  });

  it("normalizes the email to lowercase and trims spaces", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "role-arbiter", name: "ARBITER" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-3",
      name: "Ana",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date(),
      role: { id: "role-arbiter", name: "ARBITER" },
    });

    await registerUser(prisma as unknown as PrismaClient, {
      name: "  Ana  ",
      email: "  Ana@Example.COM  ",
      password: "password123",
      role: "COACH",
      acceptDataPolicy: true,
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
    expect(prisma.user.create.mock.calls[0][0].data.email).toBe("ana@example.com");
    expect(prisma.user.create.mock.calls[0][0].data.name).toBe("Ana");
  });

  it("rejects an already registered email", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "role-player", name: "PLAYER" });
    prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        name: "Duplicado",
        email: "existe@example.com",
        password: "password123",
        role: "PLAYER",
        universityCode: "U1",
        program: "Ingeniería",
        semester: 1,
        acceptDataPolicy: true,
      }),
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a role that doesn't exist in the database", async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        name: "Alguien",
        email: "alguien@example.com",
        password: "password123",
        role: "COACH",
        acceptDataPolicy: true,
      }),
    ).rejects.toMatchObject({ status: 404, code: "ROLE_NOT_FOUND" } satisfies Partial<HttpError>);
  });

  it("turns a concurrent uniqueness violation (P2002) into a 409", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: "role-organizer", name: "ORGANIZER" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockRejectedValue({ code: "P2002" });

    await expect(
      registerUser(prisma as unknown as PrismaClient, {
        name: "Carrera",
        email: "carrera@example.com",
        password: "password123",
        role: "COACH",
        acceptDataPolicy: true,
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
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-organizer", name: "ORGANIZER" },
      dataPolicyAccepted: true,
      dataPolicyAcceptedAt: new Date("2026-01-01T00:00:00Z"),
      dataPolicyVersion: "2026-08-01",
    });

    const result = await loginUser(prisma as unknown as PrismaClient, {
      email: "ana@example.com",
      password: "password123",
    });

    expect(result.user).toEqual({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      role: "ORGANIZER",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      dataConsent: {
        accepted: true,
        date: new Date("2026-01-01T00:00:00Z"),
        version: "2026-08-01",
      },
    });

    const payload = jwt.verify(result.token, "test-secret") as jwt.JwtPayload;
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ORGANIZER");
  });

  it("rejects an incorrect password with a generic message", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash,
      role: { id: "role-organizer", name: "ORGANIZER" },
    });

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "incorrecta" }),
    ).rejects.toMatchObject({ status: 401, message: "Credenciales inválidas" } satisfies Partial<HttpError>);
  });

  it("rejects a nonexistent email with the same generic message (doesn't reveal whether the account exists)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "no-existe@example.com", password: "cualquiera" }),
    ).rejects.toMatchObject({ status: 401, message: "Credenciales inválidas" } satisfies Partial<HttpError>);
  });

  it("checks the password even for an unknown email, so the response time doesn't reveal which emails exist", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    vi.mocked(comparePassword).mockClear();

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "no-existe@example.com", password: "cualquiera" }),
    ).rejects.toMatchObject({ status: 401 });

    expect(comparePassword).toHaveBeenCalledTimes(1);
    expect(vi.mocked(comparePassword).mock.calls[0]?.[0]).toBe("cualquiera");
  });

  it("upgrades a legacy bcrypt hash to the current scheme after a successful login", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("password123", 4),
      role: { id: "role-organizer", name: "ORGANIZER" },
    });

    await loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "password123" });

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.update.mock.calls[0]![0];
    expect(where).toEqual({ id: "user-1" });
    expect(data.passwordHash).toMatch(/^scrypt\$/);
    expect(await comparePassword("password123", data.passwordHash)).toBe(true);
  });

  it("leaves a current hash untouched on login", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash: await hashPassword("password123"),
      role: { id: "role-organizer", name: "ORGANIZER" },
    });

    await loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "password123" });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("never rewrites the hash when the password is wrong", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("password123", 4),
      role: { id: "role-organizer", name: "ORGANIZER" },
    });

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "incorrecta" }),
    ).rejects.toMatchObject({ status: 401 });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an inactive user even when the password is correct", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
      status: "INACTIVE",
      passwordHash,
      role: { id: "role-organizer", name: "ORGANIZER" },
    });

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "ana@example.com", password: "password123" }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<HttpError>);
  });

  it("normalizes the email to lowercase before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      loginUser(prisma as unknown as PrismaClient, { email: "  Ana@Example.COM  ", password: "x" }),
    ).rejects.toBeDefined();

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "ana@example.com" },
      include: { role: true },
    });
  });
});
