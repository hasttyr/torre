import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { discardRound, generateRound, listRounds, publishRound, swapPlayers } from "../services/rounds.service";
import { parseOrThrow } from "../validators/parse";
import { swapPlayersSchema } from "../validators/rounds.schemas";

/** GET /tournaments/:id/rounds — the tournament's rounds with their pairings (HU18). */
export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(await listRounds(prisma, String(req.params.id), req.user!));
}

/** POST /tournaments/:id/rounds — pairs the next round as a draft (HU08, HU28). */
export async function generate(req: Request, res: Response): Promise<void> {
  res.status(201).json(await generateRound(prisma, String(req.params.id), req.user!));
}

/** DELETE /rounds/:id — discards a draft round. */
export async function discard(req: Request, res: Response): Promise<void> {
  await discardRound(prisma, String(req.params.id), req.user!);
  res.status(204).send();
}

/** POST /rounds/:id/swap — swaps two players' seats in a draft round (HU29). */
export async function swap(req: Request, res: Response): Promise<void> {
  const data = parseOrThrow(swapPlayersSchema, req.body);
  res.status(200).json(await swapPlayers(prisma, String(req.params.id), data, req.user!));
}

/** POST /rounds/:id/publish — publishes a draft round (HU09). */
export async function publish(req: Request, res: Response): Promise<void> {
  res.status(200).json(await publishRound(prisma, String(req.params.id), req.user!));
}
