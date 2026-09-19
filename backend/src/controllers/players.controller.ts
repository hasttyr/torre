import { prisma } from "../config/prisma";
import { asyncHandler } from "../middlewares/asyncHandler";
import { searchPlayers } from "../services/players.service";

/** GET /players?q= — searches players by name, email or university code. */
export const search = asyncHandler(async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const players = await searchPlayers(prisma, query);
  res.status(200).json(players);
});
