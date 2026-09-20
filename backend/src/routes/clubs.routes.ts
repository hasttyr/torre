import { Router } from "express";

import { assignPlayer, create, list, listPlayers, remove, removePlayer, update } from "../controllers/clubs.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const clubsRouter = Router();

// Same roles that manage tournaments in tournaments.routes.ts: club
// management (HU23) is another organizer/administrator responsibility.
const canManage = requireRole("ORGANIZER", "ADMINISTRATOR");

clubsRouter.get("/", requireAuth, list);
clubsRouter.post("/", requireAuth, canManage, create);
clubsRouter.put("/:id", requireAuth, canManage, update);
clubsRouter.delete("/:id", requireAuth, canManage, remove);
clubsRouter.get("/:id/players", requireAuth, listPlayers);
clubsRouter.post("/:id/players", requireAuth, canManage, assignPlayer);
clubsRouter.delete("/:id/players/:playerId", requireAuth, canManage, removePlayer);
