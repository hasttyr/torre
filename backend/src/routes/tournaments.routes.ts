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

// Before "/:id": otherwise Express would try to resolve "mios"/"disponibles"/
// "inscrito" as a :id.
tournamentsRouter.get("/mios", requireAuth, canManage, listMine);
tournamentsRouter.get("/disponibles", requireAuth, listAvailable);
tournamentsRouter.get("/inscrito", requireAuth, listMyEnrollments);
tournamentsRouter.post("/", requireAuth, canManage, create);
// Restricted to the owner/an administrator (see comment in
// tournaments.service.ts): until HU18 there's no role-filtered view for
// arbiter/player/coach.
tournamentsRouter.get("/:id", requireAuth, canManage, get);
tournamentsRouter.put("/:id/configuracion", requireAuth, canManage, configure);
tournamentsRouter.post("/:id/inscripciones/abrir", requireAuth, canManage, open);
tournamentsRouter.post("/:id/inscripciones/cerrar", requireAuth, canManage, close);
tournamentsRouter.post("/:id/jugadores", requireAuth, canManage, enroll);
tournamentsRouter.get("/:id/jugadores", requireAuth, canManage, listPlayers);
