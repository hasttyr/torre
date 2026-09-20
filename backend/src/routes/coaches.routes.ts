import { Router } from "express";

import { link, listPlayers, listTournaments, unlink } from "../controllers/coaches.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const coachesRouter = Router();

const isCoach = requireRole("COACH");

coachesRouter.get("/players", requireAuth, isCoach, listPlayers);
coachesRouter.post("/players", requireAuth, isCoach, link);
coachesRouter.delete("/players/:playerId", requireAuth, isCoach, unlink);
coachesRouter.get("/tournaments", requireAuth, isCoach, listTournaments);
