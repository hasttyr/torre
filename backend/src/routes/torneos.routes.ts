import { Router } from "express";

import {
  abrir,
  cerrar,
  configurar,
  crear,
  inscribir,
  listarJugadores,
  misTorneos,
  obtener,
} from "../controllers/torneos.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const torneosRouter = Router();

const puedeAdministrar = requireRole("ORGANIZADOR", "ADMINISTRADOR");

// Antes de "/:id": si no, Express intentaría resolver "mios" como un :id.
torneosRouter.get("/mios", requireAuth, puedeAdministrar, misTorneos);
torneosRouter.post("/", requireAuth, puedeAdministrar, crear);
torneosRouter.get("/:id", requireAuth, obtener);
torneosRouter.put("/:id/configuracion", requireAuth, puedeAdministrar, configurar);
torneosRouter.post("/:id/inscripciones/abrir", requireAuth, puedeAdministrar, abrir);
torneosRouter.post("/:id/inscripciones/cerrar", requireAuth, puedeAdministrar, cerrar);
torneosRouter.post("/:id/jugadores", requireAuth, puedeAdministrar, inscribir);
torneosRouter.get("/:id/jugadores", requireAuth, listarJugadores);
