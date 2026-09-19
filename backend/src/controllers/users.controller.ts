import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { HttpError } from "../middlewares/errorHandler";
import { getUserById, updateOwnProfile, updateUserRole } from "../services/users.service";
import { updateProfileSchema, updateRoleSchema } from "../validators/users.schemas";

/** GET /users/me — returns the currently authenticated user's profile. */
export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.user always exists here: the route goes through requireAuth first.
    const user = await getUserById(prisma, req.user!.id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/** PUT /users/me — updates the currently authenticated user's own profile. */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; ")));
    return;
  }

  try {
    // req.user!.id, never req.params.id: HU20 is "edit MY OWN profile".
    const user = await updateOwnProfile(prisma, req.user!.id, parsed.data);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/** PATCH /users/:id/role — changes a user's role (admin-only). */
export async function updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; ")));
    return;
  }

  try {
    const user = await updateUserRole(prisma, String(req.params.id), parsed.data.role);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}
