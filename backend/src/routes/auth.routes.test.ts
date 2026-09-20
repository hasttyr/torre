import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

// vi.mock se hoistea por encima de TODO el archivo (incluidas las
// declaraciones const), así que el mock en sí debe crearse dentro de
// vi.hoisted para no referenciar una variable que todavía no existe.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    role: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    passwordResetRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// createApp (vía app.ts -> routes -> auth.controller) resuelve
// "../config/prisma" contra este mock, no contra un PrismaClient real.
vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a valid coach and returns 201 without exposing the hash", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-1", name: "COACH" });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "COACH" },
    });

    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "COACH",
      acceptDataPolicy: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "user-1", email: "ana@example.com", role: "COACH" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("responds 400 with an invalid email", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "no-es-un-correo",
      password: "password123",
      role: "COACH",
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("responds 400 when the player profile required for role PLAYER is missing", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      role: "PLAYER",
    });

    expect(response.status).toBe(400);
  });

  it("responds 400 when the data-treatment policy isn't accepted (RN-10/HU21)", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "COACH",
      acceptDataPolicy: false,
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("responds 400 when the role is ADMINISTRATOR (not self-assignable)", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Quiero Ser Admin",
      email: "admin@example.com",
      password: "password123",
      role: "ADMINISTRATOR",
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("responds 400 when the role is ORGANIZER (must be provisioned by an administrator)", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Quiero Ser Organizador",
      email: "organizador@example.com",
      password: "password123",
      role: "ORGANIZER",
      acceptDataPolicy: true,
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("responds 400 when the role is ARBITER (must be provisioned by an administrator)", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Quiero Ser Árbitro",
      email: "arbitro@example.com",
      password: "password123",
      role: "ARBITER",
      acceptDataPolicy: true,
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the email is already registered", async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: "role-1", name: "PLAYER" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing-user" });

    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      role: "PLAYER",
      universityCode: "U123",
      program: "Ingeniería",
      semester: 3,
      acceptDataPolicy: true,
    });

    expect(response.status).toBe(409);
  });

  it("does not expose internal details when something uncontrolled fails (e.g. the database)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.role.findUnique.mockRejectedValue(
      new Error("Can't reach database server at `localhost:5432` (ruta interna: /home/app/src/x.ts)"),
    );

    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "COACH",
      acceptDataPolicy: true,
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Error interno del servidor" });

    consoleErrorSpy.mockRestore();
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates with valid credentials and returns token + user", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Ana Torres",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      role: { id: "role-1", name: "ORGANIZER" },
    });

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: "user-1", email: "ana@example.com", role: "ORGANIZER" });
    expect(typeof response.body.token).toBe("string");
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("responds 401 with an incorrect password", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "ana@example.com",
      status: "ACTIVE",
      passwordHash,
      role: { id: "role-1", name: "ORGANIZER" },
    });

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "incorrecta" });

    expect(response.status).toBe(401);
  });

  it("responds 401 with an email that doesn't exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "no-existe@example.com", password: "cualquiera" });

    expect(response.status).toBe(401);
  });

  it("responds 400 when the password is missing", async () => {
    const response = await request(createApp()).post("/api/auth/login").send({ email: "ana@example.com" });

    expect(response.status).toBe(400);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/password/forgot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 200 with a generic message for a registered email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", status: "ACTIVE" });
    prismaMock.passwordResetRequest.create.mockResolvedValue({ id: "request-1" });
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await request(createApp()).post("/api/auth/password/forgot").send({ email: "ana@example.com" });

    expect(response.status).toBe(200);
    expect(prismaMock.passwordResetRequest.create).toHaveBeenCalledTimes(1);

    consoleLogSpy.mockRestore();
  });

  it("responds 200 with the same generic message for an unregistered email (doesn't reveal existence)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/auth/password/forgot")
      .send({ email: "no-existe@example.com" });

    expect(response.status).toBe(200);
    expect(prismaMock.passwordResetRequest.create).not.toHaveBeenCalled();
  });

  it("responds 400 with an invalid email", async () => {
    const response = await request(createApp()).post("/api/auth/password/forgot").send({ email: "no-es-un-correo" });

    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/password/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 200 and updates the password with a valid token", async () => {
    prismaMock.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prismaMock.$transaction.mockResolvedValue(undefined);

    const response = await request(createApp())
      .post("/api/auth/password/reset")
      .send({ token: "un-token-valido", newPassword: "nuevaPassword123" });

    expect(response.status).toBe(200);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("responds 400 with an expired token", async () => {
    prismaMock.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await request(createApp())
      .post("/api/auth/password/reset")
      .send({ token: "token-expirado", newPassword: "nuevaPassword123" });

    expect(response.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("responds 400 with an already-used token", async () => {
    prismaMock.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await request(createApp())
      .post("/api/auth/password/reset")
      .send({ token: "token-usado", newPassword: "nuevaPassword123" });

    expect(response.status).toBe(400);
  });

  it("responds 400 with a token that doesn't exist", async () => {
    prismaMock.passwordResetRequest.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/auth/password/reset")
      .send({ token: "token-inexistente", newPassword: "nuevaPassword123" });

    expect(response.status).toBe(400);
  });

  it("responds 400 with a password shorter than 8 characters", async () => {
    const response = await request(createApp())
      .post("/api/auth/password/reset")
      .send({ token: "cualquiera", newPassword: "corta" });

    expect(response.status).toBe(400);
    expect(prismaMock.passwordResetRequest.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("responds 204 with a valid token", async () => {
    const token = jwt.sign({ sub: "user-1", role: "ORGANIZER" }, "test-secret", { expiresIn: "1h" });

    const response = await request(createApp()).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/auth/logout");

    expect(response.status).toBe(401);
  });
});
