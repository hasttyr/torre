import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { HttpError } from "../middlewares/errorHandler";
import { loginUser, registerUser } from "../services/auth.service";
import { loginSchema, registerSchema } from "../validators/auth.schemas";

/** POST /auth/register — creates a new user account. */
export const register = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const user = await registerUser(prisma, parsed.data);
  res.status(201).json(user);
});

/** POST /auth/login — authenticates a user and returns a session token. */
export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const result = await loginUser(prisma, parsed.data);
  res.status(200).json(result);
});

// Stateless JWT: there's nothing to invalidate server-side. The endpoint
// exists for API symmetry and so the client can confirm the token it had
// was valid before discarding it.
/** POST /auth/logout — no-op confirmation endpoint (see comment above). */
export function logout(_req: Request, res: Response): void {
  res.status(204).send();
}
