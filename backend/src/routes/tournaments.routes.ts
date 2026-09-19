import { Router } from "express";

import {
  close,
  configure,
  create,
  get,
  enroll,
  listAvailable,
  listMine,
  listMyEnrollments,
  listPlayers,
  open,
} from "../controllers/tournaments.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const tournamentsRouter = Router();

const canManage = requireRole("ORGANIZADOR", "ADMINISTRADOR");

// Before "/:id": otherwise Express would try to resolve "mine"/"available"/
// "enrolled" as a :id.
tournamentsRouter.get("/mine", requireAuth, canManage, listMine);
tournamentsRouter.get("/available", requireAuth, listAvailable);
tournamentsRouter.get("/enrolled", requireAuth, listMyEnrollments);
tournamentsRouter.post("/", requireAuth, canManage, create);
// Restricted to the owner/an administrator (see comment in
// tournaments.service.ts): until HU18 there's no role-filtered view for
// arbiter/player/coach.
tournamentsRouter.get("/:id", requireAuth, canManage, get);
tournamentsRouter.put("/:id/configuration", requireAuth, canManage, configure);
tournamentsRouter.post("/:id/registration/open", requireAuth, canManage, open);
tournamentsRouter.post("/:id/registration/close", requireAuth, canManage, close);
tournamentsRouter.post("/:id/players", requireAuth, canManage, enroll);
tournamentsRouter.get("/:id/players", requireAuth, canManage, listPlayers);
