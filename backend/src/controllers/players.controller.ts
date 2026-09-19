import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { searchPlayers } from "../services/players.service";

/** GET /players?q= — searches players by name, email or university code. */
export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const players = await searchPlayers(prisma, query);
    res.status(200).json(players);
  } catch (error) {
    next(error);
  }
}
