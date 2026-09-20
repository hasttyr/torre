import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { HttpError } from "../middlewares/errorHandler";
import { exerciseDataRight } from "../services/dataRights.service";
import { getUserById, listMyCoaches, updateOwnProfile, updateUserRole } from "../services/users.service";
import { dataRequestSchema, updateProfileSchema, updateRoleSchema } from "../validators/users.schemas";

/** GET /users/me — returns the currently authenticated user's profile. */
export const me = asyncHandler(async (req, res) => {
  // req.user always exists here: the route goes through requireAuth first.
  const user = await getUserById(prisma, req.user!.id);
  res.status(200).json(user);
});

/** PUT /users/me — updates the currently authenticated user's own profile. */
export const updateProfile = asyncHandler(async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  // req.user!.id, never req.params.id: HU20 is "edit MY OWN profile".
  const user = await updateOwnProfile(prisma, req.user!.id, parsed.data);
  res.status(200).json(user);
});

/** PATCH /users/:id/role — changes a user's role (admin-only). */
export const updateRole = asyncHandler(async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const user = await updateUserRole(prisma, String(req.params.id), parsed.data.role, req.user!.id);
  res.status(200).json(user);
});

/** GET /users/me/coaches — lists the coaches linked to the current user (as a player, HU24). */
export const myCoaches = asyncHandler(async (req, res) => {
  const coaches = await listMyCoaches(prisma, req.user!.id);
  res.status(200).json(coaches);
});

/** POST /users/me/data-requests — exercises an ARCO data-subject right (HU22, Ley 1581 de 2012). */
export const exerciseRight = asyncHandler(async (req, res) => {
  const parsed = dataRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const result = await exerciseDataRight(prisma, req.user!.id, parsed.data);
  res.status(200).json(result);
});
