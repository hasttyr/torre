import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { actorOf } from "../middlewares/auth";
import { acceptCoach, removeCoach } from "../services/coaches.service";
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
import { idParam } from "../validators/params";
import { parseOrThrow } from "../validators/parse";

/** GET /users — lists every user in the system (admin-only). */
export async function list(_req: Request, res: Response): Promise<void> {
  const users = await listUsers(prisma);
  res.status(200).json(users);
}

/** GET /users/me — returns the currently authenticated user's profile. */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUserById(prisma, actorOf(req).id);
  res.status(200).json(user);
}

/** PUT /users/me — updates the currently authenticated user's own profile. */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateProfileSchema, req.body);

  // The actor, never req.params.id: HU20 is "edit MY OWN profile".
  const user = await updateOwnProfile(prisma, input, actorOf(req));
  res.status(200).json(user);
}

/** PATCH /users/:id/role — changes a user's role (admin-only). */
export async function updateRole(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateRoleSchema, req.body);

  const user = await updateUserRole(prisma, idParam(req, "id"), input.role, actorOf(req));
  res.status(200).json(user);
}

/** PATCH /users/:id/status — activates or deactivates a user account (admin-only). */
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateStatusSchema, req.body);

  const user = await updateUserStatus(prisma, idParam(req, "id"), input.status, actorOf(req));
  res.status(200).json(user);
}

/** GET /users/me/coaches — lists the coaches linked to the current user (as a player, HU24). */
export async function myCoaches(req: Request, res: Response): Promise<void> {
  const coaches = await listMyCoaches(prisma, actorOf(req));
  res.status(200).json(coaches);
}

/** POST /users/me/coaches/:coachId/accept — the current player lets a coach follow their progress (HU24). */
export async function acceptMyCoach(req: Request, res: Response): Promise<void> {
  await acceptCoach(prisma, idParam(req, "coachId"), actorOf(req));
  res.status(204).send();
}

/** DELETE /users/me/coaches/:coachId — the current player declines a coach's request, or stops them following. */
export async function removeMyCoach(req: Request, res: Response): Promise<void> {
  await removeCoach(prisma, idParam(req, "coachId"), actorOf(req));
  res.status(204).send();
}

/** POST /users/me/data-requests — exercises an ARCO data-subject right (HU22, Ley 1581 de 2012). */
export async function exerciseRight(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(dataRequestSchema, req.body);

  const result = await exerciseDataRight(prisma, input, actorOf(req));
  res.status(200).json(result);
}
