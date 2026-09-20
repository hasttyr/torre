import { Router } from "express";

import { search } from "../controllers/players.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const playersRouter = Router();

// ORGANIZER/ADMINISTRATOR: same roles that manage tournament registration in
// tournaments.routes.ts, who need to search players to enroll them. COACH:
// needs to search players to link with them (HU24).
playersRouter.get("/", requireAuth, requireRole("ORGANIZER", "ADMINISTRATOR", "COACH"), search);
