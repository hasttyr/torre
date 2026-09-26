import { Router } from "express";

import { standingsPdf } from "../controllers/exports.controller";
import { generate as generateRound, list as listRounds } from "../controllers/rounds.controller";
import {
  close,
  configure,
  create,
  finish,
  get,
  enroll,
  listAvailable,
  listLive,
  listMine,
  listMyEnrollments,
  listPlayers,
  open,
  standings,
  stats,
  withdraw,
} from "../controllers/tournaments.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const tournamentsRouter = Router();

const canManage = requireRole("ORGANIZER", "ADMINISTRATOR");
// HU30: the organizer or an arbiter (per tournament: see tournamentAccess.ts).
const isOfficial = requireRole("ARBITER", "ORGANIZER", "ADMINISTRATOR");

// Before "/:id": otherwise Express would try to resolve "mine"/"available"/
// "enrolled"/"live" as a :id.
tournamentsRouter.get("/mine", requireAuth, canManage, listMine);
tournamentsRouter.get("/available", requireAuth, listAvailable);
tournamentsRouter.get("/enrolled", requireAuth, listMyEnrollments);
tournamentsRouter.get("/live", requireAuth, listLive);
tournamentsRouter.post("/", requireAuth, canManage, create);
// HU18: any authenticated user reads a tournament's published information;
// the service hides drafts (CREATED, draft rounds) from non-managers.
tournamentsRouter.get("/:id", requireAuth, get);
tournamentsRouter.get("/:id/rounds", requireAuth, listRounds);
tournamentsRouter.get("/:id/standings", requireAuth, standings);
tournamentsRouter.get("/:id/standings.pdf", requireAuth, isOfficial, standingsPdf);
tournamentsRouter.get("/:id/stats", requireAuth, stats);
tournamentsRouter.post("/:id/rounds", requireAuth, canManage, generateRound);
tournamentsRouter.post("/:id/finish", requireAuth, canManage, finish);
tournamentsRouter.put("/:id/configuration", requireAuth, canManage, configure);
tournamentsRouter.post("/:id/registration/open", requireAuth, canManage, open);
tournamentsRouter.post("/:id/registration/close", requireAuth, canManage, close);
tournamentsRouter.post("/:id/players", requireAuth, canManage, enroll);
tournamentsRouter.get("/:id/players", requireAuth, canManage, listPlayers);
tournamentsRouter.post("/:id/players/:playerId/withdraw", requireAuth, canManage, withdraw);
