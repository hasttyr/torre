import { Router } from "express";

import { search } from "../controllers/players.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const playersRouter = Router();

// Same roles that manage tournament registration in tournaments.routes.ts:
// whoever can enroll players is who needs to search for them.
playersRouter.get("/", requireAuth, requireRole("ORGANIZADOR", "ADMINISTRADOR"), search);
