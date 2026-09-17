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

  it("registra un organizador válido y devuelve 201 sin exponer el hash", async () => {
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
      nombre: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      rol: "ORGANIZADOR",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "usuario-1", email: "ana@example.com", rol: "ORGANIZADOR" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("responde 400 con un correo inválido", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      nombre: "Ana Torres",
      email: "no-es-un-correo",
      password: "password123",
      rol: "ORGANIZADOR",
    });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it("responde 400 si falta el perfil de jugador requerido para rol JUGADOR", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      nombre: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      rol: "JUGADOR",
    });

    expect(response.status).toBe(400);
  });

  it("responde 400 si el rol es ADMINISTRADOR (no autoasignable)", async () => {
    const response = await request(createApp()).post("/api/auth/register").send({
      nombre: "Quiero Ser Admin",
      email: "admin@example.com",
      password: "password123",
      rol: "ADMINISTRADOR",
    });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });

  it("responde 409 si el correo ya está registrado", async () => {
    prismaMock.rol.findUnique.mockResolvedValue({ id: "rol-1", nombre: "JUGADOR" });
    prismaMock.usuario.findUnique.mockResolvedValue({ id: "usuario-existente" });

    const response = await request(createApp()).post("/api/auth/register").send({
      nombre: "Luis Gómez",
      email: "luis@example.com",
      password: "password123",
      rol: "JUGADOR",
      codigoUniversitario: "U123",
      programa: "Ingeniería",
      semestre: 3,
    });

    expect(response.status).toBe(409);
  });

  it("no expone detalles internos cuando falla algo no controlado (p. ej. la base de datos)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.rol.findUnique.mockRejectedValue(
      new Error("Can't reach database server at `localhost:5432` (ruta interna: /home/app/src/x.ts)"),
    );

    const response = await request(createApp()).post("/api/auth/register").send({
      nombre: "Ana Torres",
      email: "ana@example.com",
      password: "password123",
      rol: "ORGANIZADOR",
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

  it("autentica con credenciales válidas y devuelve token + usuario", async () => {
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
    expect(response.body.usuario).toMatchObject({ id: "usuario-1", email: "ana@example.com", rol: "ORGANIZADOR" });
    expect(typeof response.body.token).toBe("string");
    expect(response.body.usuario.passwordHash).toBeUndefined();
  });

  it("responde 401 con contraseña incorrecta", async () => {
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

  it("responde 401 con un correo que no existe", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "no-existe@example.com", password: "cualquiera" });

    expect(response.status).toBe(401);
  });

  it("responde 400 si falta la contraseña", async () => {
    const response = await request(createApp()).post("/api/auth/login").send({ email: "ana@example.com" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("responde 204 con un token válido", async () => {
    const token = jwt.sign({ sub: "usuario-1", rol: "ORGANIZADOR" }, "test-secret", { expiresIn: "1h" });

    const response = await request(createApp()).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).post("/api/auth/logout");

    expect(response.status).toBe(401);
  });
});
