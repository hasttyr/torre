import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { searchPlayers } from "./players.service";

function buildPrismaMock() {
  return {
    jugador: {
      findMany: vi.fn(),
    },
  };
}

describe("searchPlayers", () => {
  it("devuelve lista vacía sin llamar a la base de datos si el texto está vacío", async () => {
    const prisma = buildPrismaMock();

    const result = await searchPlayers(prisma as unknown as PrismaClient, "   ");

    expect(result).toEqual([]);
    expect(prisma.jugador.findMany).not.toHaveBeenCalled();
  });

  it("busca por nombre, correo o código universitario y mapea el DTO", async () => {
    const prisma = buildPrismaMock();
    prisma.jugador.findMany.mockResolvedValue([
      {
        id: "jugador-1",
        codigoUniversitario: "U123",
        programa: "Ingeniería de Sistemas",
        semestre: 5,
        usuario: { nombre: "Luis Gómez", email: "luis@example.com" },
      },
    ]);

    const result = await searchPlayers(prisma as unknown as PrismaClient, "Luis");

    expect(prisma.jugador.findMany.mock.calls[0][0].where.OR).toHaveLength(3);
    expect(result).toEqual([
      {
        id: "jugador-1",
        nombre: "Luis Gómez",
        email: "luis@example.com",
        codigoUniversitario: "U123",
        programa: "Ingeniería de Sistemas",
        semestre: 5,
      },
    ]);
  });
});
