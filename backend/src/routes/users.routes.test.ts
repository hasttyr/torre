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

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/users/me");
    expect(response.status).toBe(401);
  });

  it("devuelve el perfil del usuario autenticado", async () => {
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
    expect(response.body).toMatchObject({ id: "usuario-1", email: "ana@example.com", rol: "ORGANIZADOR" });
    expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({
      where: { id: "usuario-1" },
      include: { rol: true, jugador: true },
    });
  });

  it("responde 404 si el usuario del token ya no existe", async () => {
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

  it("actualiza el propio perfil (HU20)", async () => {
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
      .send({ programa: "Ingeniería", semestre: 6 });

    expect(response.status).toBe(200);
    expect(response.body.jugador).toMatchObject({ codigoUniversitario: "U1", programa: "Ingeniería", semestre: 6 });
  });

  it("ignora cualquier intento de enviar 'rol' en el body (no es un campo válido del schema)", async () => {
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
      .send({ nombre: "Ana T.", rol: "ADMINISTRADOR" });

    expect(response.status).toBe(200);
    expect(prismaMock.usuario.update.mock.calls[0][0].data).not.toHaveProperty("rol");
    expect(prismaMock.usuario.update.mock.calls[0][0].data).not.toHaveProperty("rolId");
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).put("/api/users/me").send({ nombre: "X" });
    expect(response.status).toBe(401);
  });

  it("responde 400 con un nombre demasiado corto", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ nombre: "A" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("actualiza fechaNacimiento, genero y discapacidad desde el catálogo cerrado", async () => {
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
      .send({ fechaNacimiento: "2005-06-15", genero: "FEMENINO", discapacidad: "VISUAL" });

    expect(response.status).toBe(200);
    expect(response.body.jugador.genero).toBe("FEMENINO");
    expect(response.body.jugador.discapacidad).toBe("VISUAL");
    expect(typeof response.body.jugador.edad).toBe("number");
  });

  it("responde 400 con un género fuera del catálogo (no acepta texto libre)", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ genero: "cualquier-cosa" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("responde 400 con una fecha de nacimiento futura", async () => {
    const response = await request(createApp())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR", "usuario-1")}`)
      .send({ fechaNacimiento: "2099-01-01" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/users/:id/rol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).patch("/api/users/usuario-2/rol").send({ rol: "ARBITRO" });
    expect(response.status).toBe(401);
  });

  it("responde 403 si quien pide el cambio no es ADMINISTRADOR", async () => {
    const response = await request(createApp())
      .patch("/api/users/usuario-2/rol")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`)
      .send({ rol: "ARBITRO" });

    expect(response.status).toBe(403);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("permite a un ADMINISTRADOR cambiar el rol de otro usuario", async () => {
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
      .patch("/api/users/usuario-2/rol")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR", "usuario-admin")}`)
      .send({ rol: "ARBITRO" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "usuario-2", rol: "ARBITRO" });
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: "usuario-2" },
      data: { rolId: "rol-arbitro" },
      include: { rol: true, jugador: true },
    });
  });

  it("responde 400 si el rol enviado no es uno de los válidos", async () => {
    const response = await request(createApp())
      .patch("/api/users/usuario-2/rol")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR")}`)
      .send({ rol: "SUPERUSUARIO" });

    expect(response.status).toBe(400);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el usuario objetivo no existe", async () => {
    prismaMock.rol.findUnique.mockResolvedValue({ id: "rol-arbitro", nombre: "ARBITRO" });
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    const response = await request(createApp())
      .patch("/api/users/no-existe/rol")
      .set("Authorization", `Bearer ${tokenFor("ADMINISTRADOR")}`)
      .send({ rol: "ARBITRO" });

    expect(response.status).toBe(404);
  });
});
