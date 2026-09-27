import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { exerciseDataRight } from "../services/dataRights.service";
import {
  getUserById,
  listMyCoaches,
  listUsers,
  updateOwnProfile,
  updateUserRole,
  updateUserStatus,
} from "../services/users.service";
import {
  dataRequestSchema,
  updateProfileSchema,
  updateRoleSchema,
  updateStatusSchema,
} from "../validators/users.schemas";
import { parseOrThrow } from "../validators/parse";

/** GET /users — lists every user in the system (admin-only). */
export async function list(_req: Request, res: Response): Promise<void> {
  const users = await listUsers(prisma);
  res.status(200).json(users);
}

/** GET /users/me — returns the currently authenticated user's profile. */
export async function me(req: Request, res: Response): Promise<void> {
  // req.user always exists here: the route goes through requireAuth first.
  const user = await getUserById(prisma, req.user!.id);
  res.status(200).json(user);
}

/** PUT /users/me — updates the currently authenticated user's own profile. */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateProfileSchema, req.body);

  // req.user!.id, never req.params.id: HU20 is "edit MY OWN profile".
  const user = await updateOwnProfile(prisma, req.user!.id, input);
  res.status(200).json(user);
}

/** PATCH /users/:id/role — changes a user's role (admin-only). */
export async function updateRole(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateRoleSchema, req.body);

  const user = await updateUserRole(prisma, String(req.params.id), input.role, req.user!.id);
  res.status(200).json(user);
}

/** PATCH /users/:id/status — activates or deactivates a user account (admin-only). */
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateStatusSchema, req.body);

  const user = await updateUserStatus(prisma, String(req.params.id), input.status, req.user!.id);
  res.status(200).json(user);
}

/** GET /users/me/coaches — lists the coaches linked to the current user (as a player, HU24). */
export async function myCoaches(req: Request, res: Response): Promise<void> {
  const coaches = await listMyCoaches(prisma, req.user!.id);
  res.status(200).json(coaches);
}

/** POST /users/me/data-requests — exercises an ARCO data-subject right (HU22, Ley 1581 de 2012). */
export async function exerciseRight(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(dataRequestSchema, req.body);

  const result = await exerciseDataRight(prisma, req.user!.id, input);
  res.status(200).json(result);
}
