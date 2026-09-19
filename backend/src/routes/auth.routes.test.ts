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
    rol: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

// createApp (vía app.ts -> routes -> auth.controller) resuelve
// "../config/prisma" contra este mock, no contra un PrismaClient real.
vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a valid organizer and returns 201 without exposing the hash", async () => {
    prismaMock.rol.findUnique.mockResolvedValue({ id: "rol-1", nombre: "ORGANIZADOR" });
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-1", nombre: "ORGANIZADOR" },
    });

    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "ORGANIZADOR",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "usuario-1", email: "ana@example.com", role: "ORGANIZADOR" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("responds 400 with an invalid email", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "no-es-un-correo",
      password: "password123",
      role: "ORGANIZADOR",
    });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it("responds 400 when the player profile required for role JUGADOR is missing", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      role: "JUGADOR",
    });

    expect(response.status).toBe(400);
  });

  it("responds 400 when the role is ADMINISTRADOR (not self-assignable)", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Quiero Ser Admin",
      email: "admin@example.com",
      password: "password123",
      role: "ADMINISTRADOR",
    });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it("responds 409 when the email is already registered", async () => {
    prismaMock.rol.findUnique.mockResolvedValue({ id: "rol-1", nombre: "JUGADOR" });
    prismaMock.usuario.findUnique.mockResolvedValue({ id: "usuario-existente" });

    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      role: "JUGADOR",
      universityCode: "U123",
      program: "Ingeniería",
      semester: 3,
    });

    expect(response.status).toBe(409);
  });

  it("does not expose internal details when something uncontrolled fails (e.g. the database)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.rol.findUnique.mockRejectedValue(
      new Error("Can't reach database server at `localhost:5432` (ruta interna: /home/app/src/x.ts)"),
    );

    const response = await request(createApp()).post("/api/auth/register").send({
      name: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      role: "ORGANIZADOR",
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
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-1", nombre: "ORGANIZADOR" },
    });

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: "usuario-1", email: "ana@example.com", role: "ORGANIZADOR" });
    expect(typeof response.body.token).toBe("string");
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("responds 401 with an incorrect password", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      email: "ana@example.com",
      estado: "ACTIVO",
      passwordHash,
      rol: { id: "rol-1", nombre: "ORGANIZADOR" },
    });

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: "incorrecta" });

    expect(response.status).toBe(401);
  });

  it("responds 401 with an email that doesn't exist", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "no-existe@example.com", password: "cualquiera" });

    expect(response.status).toBe(401);
  });

  it("responds 400 when the password is missing", async () => {
    const response = await request(createApp()).post("/api/auth/login").send({ email: "ana@example.com" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("responds 204 with a valid token", async () => {
    const token = jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR" }, "test-secret", { expiresIn: "1h" });

    const response = await request(createApp()).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).post("/api/auth/logout");

    expect(response.status).toBe(401);
  });
});
