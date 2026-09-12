import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/errorHandler";
import { registerUser } from "../services/auth.service";
import { registerSchema } from "../validators/auth.schemas";

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; ")));
    return;
  }

  try {
    const usuario = await registerUser(prisma, parsed.data);
    res.status(201).json(usuario);
  } catch (error) {
    next(error);
  }
}
