import crypto from "node:crypto";

import type { PrismaClient } from "../generated/prisma/client";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { HttpError } from "../errors/apiErrors";
import { hashPassword } from "./password";
import type { ResetLinkSender } from "./resetLinkSender";
import { REVOKE_SESSIONS } from "./sessionToken";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora (RF11/HU19).

/** Hashes a reset token for storage; the raw token is never persisted. */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** The frontend page (see frontend/src/router) where the token is exchanged for a new password. */
function resetLink(token: string): string {
  return `${env.appUrl.replace(/\/$/, "")}/restablecer-password?token=${token}`;
}

/**
 * Requests a password reset for the given email (HU19).
 *
 * @remarks
 * Always resolves the same way whether or not the email is registered (CA:
 * "a non-registered email doesn't reveal whether an account exists"). That's
 * also why the link is sent without waiting for it: neither the provider's
 * latency nor its failure may show up in the answer.
 */
export async function requestPasswordReset(
  prisma: PrismaClient,
  email: string,
  sender: ResetLinkSender,
): Promise<void> {
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

  sender.send(user.email, resetLink(token)).catch((error: unknown) => {
    // The error names the provider's problem; the token stays out of the logs.
    logger.error({ err: error, userId: user.id }, "could not send a password-reset link");
  });
}

/**
 * Confirms a password reset with a one-time token (HU19).
 *
 * @throws {HttpError} 400 if the token is invalid, expired, or already used.
 */
export async function confirmPasswordReset(prisma: PrismaClient, token: string, newPassword: string): Promise<void> {
  const request = await prisma.passwordResetRequest.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!request || request.usedAt || request.expiresAt < new Date()) {
    throw new HttpError("RESET_LINK_INVALID");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Claims the link: of two confirmations racing with it, both read it
    // unused above, but only the first one's update matches the row.
    const { count } = await tx.passwordResetRequest.updateMany({
      where: { id: request.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count === 0) {
      throw new HttpError("RESET_LINK_INVALID");
    }
    // A new password also ends every session opened with the old one...
    await tx.user.update({ where: { id: request.userId }, data: { passwordHash, ...REVOKE_SESSIONS } });
    // ...and every other link sent to the account (the mailbox they went to
    // may be what's being recovered from).
    await tx.passwordResetRequest.updateMany({
      where: { userId: request.userId, id: { not: request.id }, usedAt: null },
      data: { expiresAt: now },
    });
  });
}
