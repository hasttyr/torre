import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/errorHandler";
import { loginUser, registerUser } from "../services/auth.service";
import { loginSchema, registerSchema } from "../validators/auth.schemas";

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

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; ")));
    return;
  }

  try {
    const result = await loginUser(prisma, parsed.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// JWT sin estado: no hay nada que invalidar en el servidor. El endpoint
// existe por simetría de la API y para que el cliente confirme que el
// token que tenía era válido antes de descartarlo.
export function logout(_req: Request, res: Response): void {
  res.status(204).send();
}
