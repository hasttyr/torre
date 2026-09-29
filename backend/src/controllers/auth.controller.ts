import type { Request, Response } from "express";

import { resetLinkSender } from "../config/mailer";
import { prisma } from "../config/prisma";
import type { AuthResult } from "../contracts/responses";
import { HttpError } from "../errors/apiErrors";
import { actorOf } from "../middlewares/auth";
import { clearSessionCookie, setSessionCookie } from "../middlewares/sessionCookie";
import { issueSocketTicket, loginUser, registerUser, revokeSessions } from "../services/auth.service";
import { confirmPasswordReset, requestPasswordReset } from "../services/passwordReset.service";
import {
  confirmPasswordResetSchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
} from "../validators/auth.schemas";
import { parseOrThrow } from "../validators/parse";

/** POST /auth/register — creates a new user account. */
export async function register(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(registerSchema, req.body);

  const user = await registerUser(prisma, input);
  res.status(201).json(user);
}

/** POST /auth/login — authenticates a user and starts the browser's session (an HttpOnly cookie). */
export async function login(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(loginSchema, req.body);

  const { token, user } = await loginUser(prisma, input);
  setSessionCookie(res, token);
  res.status(200).json({ user } satisfies AuthResult);
}

/**
 * POST /auth/logout — ends the user's sessions on every device: the token
 * stops working right away, not when it expires (see sessionToken.ts).
 */
export async function logout(req: Request, res: Response): Promise<void> {
  await revokeSessions(prisma, actorOf(req));
  clearSessionCookie(res);
  res.status(204).send();
}

/** POST /auth/socket-ticket — a one-minute ticket to open a real-time connection as the signed-in user. */
export async function socketTicket(req: Request, res: Response): Promise<void> {
  res.status(200).json(await issueSocketTicket(prisma, actorOf(req)));
}

/** POST /auth/password/forgot — requests a password-reset link (HU19). */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(requestPasswordResetSchema, req.body);
  // No mail provider (production without SMTP_URL): the same answer for
  // every email, so it doesn't tell whether an account exists.
  if (!resetLinkSender) throw new HttpError("PASSWORD_RESET_UNAVAILABLE");

  await requestPasswordReset(prisma, input.email, resetLinkSender);
  // Generic response regardless of whether the email is registered (CA HU19).
  res
    .status(200)
    .json({ message: "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña" });
}

/** POST /auth/password/reset — confirms a password reset with a one-time token (HU19). */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(confirmPasswordResetSchema, req.body);

  await confirmPasswordReset(prisma, input.token, input.newPassword);
  res.status(200).json({ message: "Contraseña actualizada correctamente" });
}
