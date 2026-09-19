import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    jugador: { findMany: vi.fn() },
  },
}));

vi.mock("../config/prisma", () => ({ prisma: prismaMock }));

function tokenFor(rol: string): string {
  return jwt.sign({ sub: "usuario-1", rol }, "test-secret", { expiresIn: "1h" });
}

describe("GET /api/jugadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("busca jugadores y responde 200 con el DTO esperado", async () => {
    prismaMock.jugador.findMany.mockResolvedValue([
      {
        id: "jugador-1",
        codigoUniversitario: "U123",
        programa: "Sistemas",
        semestre: 5,
        usuario: { nombre: "Luis Gómez", email: "luis@example.com" },
      },
    ]);

    const response = await request(createApp())
      .get("/api/jugadores?q=Luis")
      .set("Authorization", `Bearer ${tokenFor("ORGANIZADOR")}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: "jugador-1",
        nombre: "Luis Gómez",
        email: "luis@example.com",
        codigoUniversitario: "U123",
        programa: "Sistemas",
        semestre: 5,
      },
    ]);
  });

  it("responde 401 sin token", async () => {
    const response = await request(createApp()).get("/api/jugadores?q=Luis");
    expect(response.status).toBe(401);
  });

  it("responde 403 para un rol sin permiso (JUGADOR)", async () => {
    const response = await request(createApp())
      .get("/api/jugadores?q=Luis")
      .set("Authorization", `Bearer ${tokenFor("JUGADOR")}`);

    expect(response.status).toBe(403);
  });
});
