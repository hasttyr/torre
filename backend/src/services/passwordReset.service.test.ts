import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../middlewares/errorHandler";
import { confirmPasswordReset, requestPasswordReset } from "./passwordReset.service";

function buildPrismaMock() {
  return {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((operations: unknown[]) => Promise.all(operations)),
  };
}

describe("requestPasswordReset", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("creates a reset request for a registered, active user", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", status: "ACTIVE" });
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await requestPasswordReset(prisma as unknown as PrismaClient, "ana@example.com");

    expect(prisma.passwordResetRequest.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.passwordResetRequest.create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe("user-1");
    expect(createArgs.data.tokenHash).toHaveLength(64); // sha256 hex digest
    expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

    consoleLogSpy.mockRestore();
  });

  it("does nothing for an email that doesn't exist (no reveal of account existence)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await requestPasswordReset(prisma as unknown as PrismaClient, "no-existe@example.com");

    expect(prisma.passwordResetRequest.create).not.toHaveBeenCalled();
  });

  it("does nothing for an inactive account", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", status: "INACTIVE" });

    await requestPasswordReset(prisma as unknown as PrismaClient, "ana@example.com");

    expect(prisma.passwordResetRequest.create).not.toHaveBeenCalled();
  });

  it("normalizes the email before looking it up", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await requestPasswordReset(prisma as unknown as PrismaClient, "  Ana@Example.COM  ");

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "ana@example.com" } });
  });
});

describe("confirmPasswordReset", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
  });

  it("updates the password and marks the request as used with a valid token", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await confirmPasswordReset(prisma as unknown as PrismaClient, "un-token-valido", "nuevaPassword123");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
    expect(prisma.passwordResetRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "request-1" } }),
    );
  });

  it("rejects a token that doesn't exist", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue(null);

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "no-existe", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "expirado", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });

  it("rejects an already-used token", async () => {
    prisma.passwordResetRequest.findUnique.mockResolvedValue({
      id: "request-1",
      userId: "user-1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      confirmPasswordReset(prisma as unknown as PrismaClient, "usado", "nuevaPassword123"),
    ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
  });
});
