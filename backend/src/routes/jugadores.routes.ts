import { Router } from "express";

import { buscar } from "../controllers/jugadores.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const jugadoresRouter = Router();

// Mismos roles que administran inscripciones en torneos.routes.ts: quien
// puede inscribir jugadores es quien necesita buscarlos.
jugadoresRouter.get("/", requireAuth, requireRole("ORGANIZADOR", "ADMINISTRADOR"), buscar);
