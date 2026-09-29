import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
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
import { idParam } from "../validators/params";
import { parseOrThrow } from "../validators/parse";

/** POST /clubs — creates a new club (HU23). */
export async function create(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createClubSchema, req.body);

  const club = await createClub(prisma, input);
  res.status(201).json(club);
}

/** GET /clubs — lists all clubs. */
export async function list(_req: Request, res: Response): Promise<void> {
  const clubs = await listClubs(prisma);
  res.status(200).json(clubs);
}

/** PUT /clubs/:id — renames a club (HU23). */
export async function update(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateClubSchema, req.body);

  const club = await updateClub(prisma, idParam(req, "id"), input);
  res.status(200).json(club);
}

/** DELETE /clubs/:id — deletes a club (must be empty). */
export async function remove(req: Request, res: Response): Promise<void> {
  await deleteClub(prisma, idParam(req, "id"));
  res.status(204).send();
}

/** GET /clubs/:id/players — lists the players belonging to a club. */
export async function listPlayers(req: Request, res: Response): Promise<void> {
  const players = await listClubPlayers(prisma, idParam(req, "id"));
  res.status(200).json(players);
}

/** POST /clubs/:id/players — associates a player with the club (HU23). */
export async function assignPlayer(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(assignPlayerSchema, req.body);

  const player = await assignPlayerToClub(prisma, idParam(req, "id"), input);
  res.status(201).json(player);
}

/** DELETE /clubs/:id/players/:playerId — removes a player from the club (HU23). */
export async function removePlayer(req: Request, res: Response): Promise<void> {
  await removePlayerFromClub(prisma, idParam(req, "id"), idParam(req, "playerId"));
  res.status(204).send();
}
