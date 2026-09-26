import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { linkPlayer, listCoachTournaments, listLinkedPlayers, unlinkPlayer } from "../services/coaches.service";
import { linkPlayerSchema } from "../validators/coaches.schemas";
import { parseOrThrow } from "../validators/parse";

/** POST /coaches/players — links the current coach to a player (HU24). */
export const link = asyncHandler(async (req, res) => {
  const input = parseOrThrow(linkPlayerSchema, req.body);

  const player = await linkPlayer(prisma, req.user!.id, input);
  res.status(201).json(player);
});

/** GET /coaches/players — lists the players the current coach is linked to. */
export const listPlayers = asyncHandler(async (req, res) => {
  const players = await listLinkedPlayers(prisma, req.user!.id);
  res.status(200).json(players);
});

/** DELETE /coaches/players/:playerId — unlinks a player from the current coach (HU24). */
export const unlink = asyncHandler(async (req, res) => {
  await unlinkPlayer(prisma, req.user!.id, String(req.params.playerId));
  res.status(204).send();
});

/** GET /coaches/tournaments — lists tournaments where the coach's linked players are enrolled. */
export const listTournaments = asyncHandler(async (req, res) => {
  const tournaments = await listCoachTournaments(prisma, req.user!.id);
  res.status(200).json(tournaments);
});
