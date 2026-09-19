import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import { confirmPasswordReset, requestPasswordReset } from "./passwordReset.service";

function buildPrismaMock() {
  return {
    usuario: { findUnique: vi.fn(), update: vi.fn() },
    solicitudRecuperacion: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  };
}

describe("requestPasswordReset", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("creates a reset request for a registered, active user", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-1", estado: "ACTIVO" });
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await requestPasswordReset(prisma as unknown as PrismaClient, "ana@example.com");

    expect(prisma.solicitudRecuperacion.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.solicitudRecuperacion.create.mock.calls[0][0];
    expect(createArgs.data.usuarioId).toBe("usuario-1");
    expect(createArgs.data.tokenHash).toHaveLength(64); // sha256 hex digest
    expect(createArgs.data.expiraEn.getTime()).toBeGreaterThan(Date.now());

    consoleLogSpy.mockRestore();
  });

  it("does nothing for an email that doesn't exist (no reveal of account existence)", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await requestPasswordReset(prisma as unknown as PrismaClient, "no-existe@example.com");

    expect(prisma.solicitudRecuperacion.create).not.toHaveBeenCalled();
  });

  it("does nothing for an inactive account", async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: "usuario-1", estado: "INACTIVO" });

    await requestPasswordReset(prisma as unknown as PrismaClient, "ana@example.com");

    expect(prisma.solicitudRecuperacion.create).not.toHaveBeenCalled();
  });

  it("normalizes the email before looking it up", async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await requestPasswordReset(prisma as unknown as PrismaClient, "  Ana@Example.COM  ");

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
  });
});

describe("confirmPasswordReset", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("updates the password and marks the request as used with a valid token", async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue({
      id: "solicitud-1",
      usuarioId: "usuario-1",
      usadoEn: null,
      expiraEn: new Date(Date.now() + 60_000),
    });

    await confirmPasswordReset(prisma as unknown as PrismaClient, "un-token-valido", "nuevaPassword123");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "usuario-1" } }),
    );
    expect(prisma.solicitudRecuperacion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "solicitud-1" } }),
    );
  });

  it("rejects a token that doesn't exist", async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue(null);

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "no-existe", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue({
      id: "solicitud-1",
      usuarioId: "usuario-1",
      usadoEn: null,
      expiraEn: new Date(Date.now() - 60_000),
    });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "expirado", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it("rejects an already-used token", async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue({
      id: "solicitud-1",
      usuarioId: "usuario-1",
      usadoEn: new Date(),
      expiraEn: new Date(Date.now() + 60_000),
    });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "usado", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });
});
