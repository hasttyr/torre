import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { discardRound, generateRound, listRounds, publishRound, swapPlayers } from "../services/rounds.service";
import { parseOrThrow } from "../validators/parse";
import { swapPlayersSchema } from "../validators/rounds.schemas";

/** GET /tournaments/:id/rounds — the tournament's rounds with their pairings (HU18). */
export const list = asyncHandler(async (req, res) => {
  res.status(200).json(await listRounds(prisma, String(req.params.id), req.user!));
});

/** POST /tournaments/:id/rounds — pairs the next round as a draft (HU08, HU28). */
export const generate = asyncHandler(async (req, res) => {
  res.status(201).json(await generateRound(prisma, String(req.params.id), req.user!));
});

/** DELETE /rounds/:id — discards a draft round. */
export const discard = asyncHandler(async (req, res) => {
  await discardRound(prisma, String(req.params.id), req.user!);
  res.status(204).send();
});

/** POST /rounds/:id/swap — swaps two players' seats in a draft round (HU29). */
export const swap = asyncHandler(async (req, res) => {
  const data = parseOrThrow(swapPlayersSchema, req.body);
  res.status(200).json(await swapPlayers(prisma, String(req.params.id), data, req.user!));
});

/** POST /rounds/:id/publish — publishes a draft round (HU09). */
export const publish = asyncHandler(async (req, res) => {
  res.status(200).json(await publishRound(prisma, String(req.params.id), req.user!));
});
