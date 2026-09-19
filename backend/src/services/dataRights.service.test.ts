import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exerciseDataRight } from "./dataRights.service";

function buildPrismaMock() {
  return {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    jugador: { findUnique: vi.fn() },
    inscripcion: { findFirst: vi.fn() },
    solicitudDatosPersonales: { create: vi.fn() },
  };
}

const baseUser = {
  id: "usuario-1",
  nombre: "Ana Torres",
  email: "ana@example.com",
  estado: "ACTIVO",
  createdAt: new Date("2026-01-01"),
  rol: { nombre: "JUGADOR" },
  jugador: null,
  consentimientoAceptado: true,
  consentimientoFecha: new Date("2026-01-01"),
  consentimientoVersion: "2026-08-01",
};

describe("exerciseDataRight", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("ACCESO: returns the user's own data and logs the request as resolved", async () => {
    prisma.usuario.findUnique.mockResolvedValue(baseUser);

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "usuario-1", { type: "ACCESO" });

    expect(result.status).toBe("RESUELTA");
    expect(result.user.email).toBe("ana@example.com");
    expect(prisma.solicitudDatosPersonales.create).toHaveBeenCalledWith({
      data: { usuarioId: "usuario-1", tipo: "ACCESO", estado: "RESUELTA" },
    });
  });

  it("RECTIFICACION: applies the update and logs the request as resolved", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...baseUser, jugador: null });
    prisma.usuario.update.mockResolvedValue({ ...baseUser, nombre: "Ana T." });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "usuario-1", {
      type: "RECTIFICACION",
      data: { name: "Ana T." },
    });

    expect(result.status).toBe("RESUELTA");
    expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ nombre: "Ana T." });
    expect(prisma.solicitudDatosPersonales.create).toHaveBeenCalledWith({
      data: { usuarioId: "usuario-1", tipo: "RECTIFICACION", estado: "RESUELTA" },
    });
  });

  it("SUPRESION: anonymizes and resolves when there's no active tournament enrollment", async () => {
    prisma.jugador.findUnique.mockResolvedValue({ id: "jugador-1", usuarioId: "usuario-1" });
    prisma.inscripcion.findFirst.mockResolvedValue(null);
    prisma.usuario.update.mockResolvedValue({ ...baseUser, nombre: "Usuario eliminado", estado: "INACTIVO" });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "usuario-1", { type: "SUPRESION" });

    expect(result.status).toBe("RESUELTA");
    expect(prisma.usuario.update.mock.calls[0][0].data).toMatchObject({ estado: "INACTIVO" });
    expect(prisma.solicitudDatosPersonales.create).toHaveBeenCalledWith({
      data: { usuarioId: "usuario-1", tipo: "SUPRESION", estado: "RESUELTA", detalle: undefined },
    });
  });

  it("SUPRESION: blocks (deactivates without erasing) when the player has an active tournament enrollment", async () => {
    prisma.jugador.findUnique.mockResolvedValue({ id: "jugador-1", usuarioId: "usuario-1" });
    prisma.inscripcion.findFirst.mockResolvedValue({ id: "inscripcion-1" });
    prisma.usuario.update.mockResolvedValue({ ...baseUser, estado: "INACTIVO" });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "usuario-1", {
      type: "SUPRESION",
      reason: "Ya no quiero participar",
    });

    expect(result.status).toBe("BLOQUEADA");
    expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ estado: "INACTIVO" });
    expect(prisma.usuario.update.mock.calls[0][0].data.nombre).toBeUndefined();
    expect(prisma.solicitudDatosPersonales.create).toHaveBeenCalledWith({
      data: {
        usuarioId: "usuario-1",
        tipo: "SUPRESION",
        estado: "BLOQUEADA",
        detalle: "Ya no quiero participar",
      },
    });
  });

  it("SUPRESION: resolves without a block when the user has no player profile at all", async () => {
    prisma.jugador.findUnique.mockResolvedValue(null);
    prisma.usuario.update.mockResolvedValue({ ...baseUser, estado: "INACTIVO" });

    const result = await exerciseDataRight(prisma as unknown as PrismaClient, "usuario-1", { type: "SUPRESION" });

    expect(result.status).toBe("RESUELTA");
    expect(prisma.inscripcion.findFirst).not.toHaveBeenCalled();
  });
});
