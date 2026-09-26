import { Router } from "express";

import { pairingsPdf } from "../controllers/exports.controller";
import { correct, record } from "../controllers/results.controller";
import { discard, publish, swap } from "../controllers/rounds.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

// Coarse role gates only; whether this user may act on THIS tournament
// (its organizer, any arbiter for results) is decided in the services via
// tournamentAccess.ts.
const canManage = requireRole("ORGANIZER", "ADMINISTRATOR");
// RN-06
const canRecordResults = requireRole("ARBITER", "ORGANIZER", "ADMINISTRATOR");

export const roundsRouter = Router();

roundsRouter.delete("/:id", requireAuth, canManage, discard);
roundsRouter.post("/:id/swap", requireAuth, canManage, swap);
roundsRouter.post("/:id/publish", requireAuth, canManage, publish);
// HU30: same audience as result recording (RN-06): arbiters and the organizer.
roundsRouter.get("/:id/pairings.pdf", requireAuth, canRecordResults, pairingsPdf);

export const matchesRouter = Router();

matchesRouter.post("/:id/result", requireAuth, canRecordResults, record);
matchesRouter.put("/:id/result", requireAuth, canRecordResults, correct);
