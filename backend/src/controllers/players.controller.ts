import type { Request, Response } from "express";

import { prisma } from "../config/prisma";
import { actorOf } from "../middlewares/auth";
import { searchPlayers } from "../services/players.service";
import { parseOrThrow } from "../validators/parse";
import { playerSearchQuerySchema } from "../validators/players.schemas";

/** GET /players?q= — searches players by name, email or university code. */
export async function search(req: Request, res: Response): Promise<void> {
  const { q } = parseOrThrow(playerSearchQuerySchema, req.query);
  res.status(200).json(await searchPlayers(prisma, q, actorOf(req)));
}
