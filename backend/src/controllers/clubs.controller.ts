import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { HttpError } from "../middlewares/errorHandler";
import {
  assignPlayerToClub,
  createClub,
  deleteClub,
  listClubPlayers,
  listClubs,
  removePlayerFromClub,
  updateClub,
} from "../services/clubs.service";
import { assignPlayerSchema, createClubSchema, updateClubSchema } from "../validators/clubs.schemas";

/** POST /clubs — creates a new club (HU23). */
export const create = asyncHandler(async (req, res) => {
  const parsed = createClubSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const club = await createClub(prisma, parsed.data);
  res.status(201).json(club);
});

/** GET /clubs — lists all clubs. */
export const list = asyncHandler(async (_req, res) => {
  const clubs = await listClubs(prisma);
  res.status(200).json(clubs);
});

/** PUT /clubs/:id — renames a club (HU23). */
export const update = asyncHandler(async (req, res) => {
  const parsed = updateClubSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const club = await updateClub(prisma, String(req.params.id), parsed.data);
  res.status(200).json(club);
});

/** DELETE /clubs/:id — deletes a club (must be empty). */
export const remove = asyncHandler(async (req, res) => {
  await deleteClub(prisma, String(req.params.id));
  res.status(204).send();
});

/** GET /clubs/:id/players — lists the players belonging to a club. */
export const listPlayers = asyncHandler(async (req, res) => {
  const players = await listClubPlayers(prisma, String(req.params.id));
  res.status(200).json(players);
});

/** POST /clubs/:id/players — associates a player with the club (HU23). */
export const assignPlayer = asyncHandler(async (req, res) => {
  const parsed = assignPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const player = await assignPlayerToClub(prisma, String(req.params.id), parsed.data);
  res.status(201).json(player);
});

/** DELETE /clubs/:id/players/:playerId — removes a player from the club (HU23). */
export const removePlayer = asyncHandler(async (req, res) => {
  await removePlayerFromClub(prisma, String(req.params.id), String(req.params.playerId));
  res.status(204).send();
});
