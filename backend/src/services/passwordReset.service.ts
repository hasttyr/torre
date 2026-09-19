import crypto from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { HttpError } from "../middlewares/errorHandler";
import { hashPassword } from "./password";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora (RF11/HU19).

/** Hashes a reset token for storage; the raw token is never persisted. */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Requests a password reset for the given email (HU19).
 *
 * @remarks
 * Always resolves the same way whether or not the email is registered (CA:
 * "a non-registered email doesn't reveal whether an account exists"). No
 * SMTP provider is wired up in this project's architecture yet, so the
 * one-time link is logged instead of emailed — exactly where a provider
 * call would go once one exists.
 */
export async function requestPasswordReset(prisma: PrismaClient, email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Same silent no-op for "doesn't exist" and "exists but inactive": neither
  // case should let an attacker distinguish a valid account from an invalid one.
  if (!user || user.status !== "ACTIVE") {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetRequest.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  // Placeholder for an email provider call (see model comment in schema.prisma).
  console.log(`[password-reset] Enlace de restablecimiento para ${normalizedEmail}: token=${token}`);
}

/**
 * Confirms a password reset with a one-time token (HU19).
 *
 * @throws {HttpError} 400 if the token is invalid, expired, or already used.
 */
export async function confirmPasswordReset(prisma: PrismaClient, token: string, newPassword: string): Promise<void> {
  const request = await prisma.passwordResetRequest.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!request || request.usedAt || request.expiresAt < new Date()) {
    throw new HttpError(400, "El enlace de restablecimiento no es válido o ya expiró");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: request.userId }, data: { passwordHash } }),
    prisma.passwordResetRequest.update({ where: { id: request.id }, data: { usedAt: new Date() } }),
  ]);
}
