import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rol: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(rol: string, id = "usuario-1"): string {
  return jwt.sign({ sub: id, rol }, "test-secret", { expiresIn: "1h" });
}

describe("GET /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).get("/api/users/me");
    expect(response.status).toBe(401);
  });

  it("returns the authenticated user's profile", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana Torres",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-1", nombre: "ORGANIZADOR" },
    });

    const response = await request(createApp())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "usuario-1", email: "ana@example.com", role: "ORGANIZADOR" });
    expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({
      where: { id: "usuario-1" },
      include: { rol: true, jugador: true },
    });
  });

  it("responds 404 when the token's user no longer exists", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`);

    expect(response.status).toBe(404);
  });
});

describe("PUT /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the user's own profile (HU20)", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    });
    prismaMock.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-1", nombre: "JUGADOR" },
      jugador: { codigoUniversitario: "U1", programa: "Ingeniería", semestre: 6 },
    });

    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ program: "Ingeniería", semester: 6 });

    expect(response.status).toBe(200);
    expect(response.body.player).toMatchObject({ universityCode: "U1", program: "Ingeniería", semester: 6 });
  });

  it("ignores any attempt to send 'rol' in the body (not a valid schema field)", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({ id: "usuario-1", jugador: null });
    prismaMock.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Ana T.",
      email: "ana@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-1", nombre: "ORGANIZADOR" },
      jugador: null,
    });

    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR", "usuario-1")}`)
      .send({ name: "Ana T.", role: "ADMINISTRADOR" });

    expect(response.status).toBe(200);
    expect(prismaMock.usuario.update.mock.calls[0][0].data).not.toHaveProperty("rol");
    expect(prismaMock.usuario.update.mock.calls[0][0].data).not.toHaveProperty("rolId");
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).put("/api/users/me").send({ name: "X" });
    expect(response.status).toBe(401);
  });

  it("responds 400 with a name that's too short", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ name: "A" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("updates fechaNacimiento, genero and discapacidad from the closed catalog", async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: "usuario-1",
      jugador: { codigoUniversitario: "U1", programa: "Sistemas", semestre: 5 },
    });
    prismaMock.usuario.update.mockResolvedValue({
      id: "usuario-1",
      nombre: "Luis Gómez",
      email: "luis@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-1", nombre: "JUGADOR" },
      jugador: {
        codigoUniversitario: "U1",
        programa: "Sistemas",
        semestre: 5,
        fechaNacimiento: new Date("2005-06-15"),
        genero: "FEMENINO",
        discapacidad: "VISUAL",
      },
    });

    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ birthDate: "2005-06-15", gender: "FEMENINO", disability: "VISUAL" });

    expect(response.status).toBe(200);
    expect(response.body.player.gender).toBe("FEMENINO");
    expect(response.body.player.disability).toBe("VISUAL");
    expect(typeof response.body.player.age).toBe("number");
  });

  it("responds 400 with a gender outside the catalog (doesn't accept free text)", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ gender: "cualquier-cosa" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("responds 400 with a future birth date", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ birthDate: "2099-01-01" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/users/:id/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 401 without a token", async () => {
    const response = await request(createApp()).patch("/api/users/usuario-2/role").send({ role: "ARBITRO" });
    expect(response.status).toBe(401);
  });

  it("responds 403 when whoever requests the change isn't ADMINISTRADOR", async () => {
    const response = await request(createApp())
      .patch("/api/users/usuario-2/role")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`)
      .send({ role: "ARBITRO" });

    expect(response.status).toBe(403);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("allows an ADMINISTRADOR to change another user's role", async () => {
    prismaMock.rol.findUnique.mockResolvedValue({ id: "rol-arbitro", nombre: "ARBITRO" });
    prismaMock.usuario.findUnique.mockResolvedValue({ id: "usuario-2" });
    prismaMock.usuario.update.mockResolvedValue({
      id: "usuario-2",
      nombre: "Carlos",
      email: "carlos@example.com",
      estado: "ACTIVO",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      rol: { id: "rol-arbitro", nombre: "ARBITRO" },
    });

    const response = await request(createApp())
      .patch("/api/users/usuario-2/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR", "usuario-admin")}`)
      .send({ role: "ARBITRO" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "usuario-2", role: "ARBITRO" });
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: "usuario-2" },
      data: { rolId: "rol-arbitro" },
      include: { rol: true, jugador: true },
    });
  });

  it("responds 400 when the sent role isn't one of the valid ones", async () => {
    const response = await request(createApp())
      .patch("/api/users/usuario-2/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR")}`)
      .send({ role: "SUPERUSUARIO" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("responds 404 when the target user doesn't exist", async () => {
    prismaMock.rol.findUnique.mockResolvedValue({ id: "rol-arbitro", nombre: "ARBITRO" });
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .patch("/api/users/no-existe/role")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR")}`)
      .send({ role: "ARBITRO" });

    expect(response.status).toBe(404);
  });
});
