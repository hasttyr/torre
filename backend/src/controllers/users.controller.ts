import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/errorHandler";
import { getUserById, updateUserRole } from "../services/users.service";
import { updateRoleSchema } from "../validators/users.schemas";

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.user siempre existe acá: la ruta pasa por requireAuth antes.
    const usuario = await getUserById(prisma, req.user!.id);
    res.status(200).json(usuario);
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; ")));
    return;
  }

  try {
    const usuario = await updateUserRole(prisma, String(req.params.id), parsed.data.rol);
    res.status(200).json(usuario);
  } catch (error) {
    next(error);
  }
}
