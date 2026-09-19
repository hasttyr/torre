import { Router } from "express";

import {
  abrir,
  cerrar,
  configurar,
  crear,
  disponibles,
  inscribir,
  listarJugadores,
  misInscripciones,
  misTorneos,
  obtener,
} from "../controllers/torneos.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const torneosRouter = Router();

const puedeAdministrar = requireRole("ORGANIZADOR", "ADMINISTRADOR");

// Antes de "/:id": si no, Express intentaría resolver "mios"/"disponibles"/
// "inscrito" como un :id.
torneosRouter.get("/mios", requireAuth, puedeAdministrar, misTorneos);
torneosRouter.get("/disponibles", requireAuth, disponibles);
torneosRouter.get("/inscrito", requireAuth, misInscripciones);
torneosRouter.post("/", requireAuth, puedeAdministrar, crear);
// Restringidos a dueño/administrador (ver comentario en torneos.service.ts):
// hasta HU18 no hay vista filtrada por rol para árbitro/jugador/entrenador.
torneosRouter.get("/:id", requireAuth, puedeAdministrar, obtener);
torneosRouter.put("/:id/configuracion", requireAuth, puedeAdministrar, configurar);
torneosRouter.post("/:id/inscripciones/abrir", requireAuth, puedeAdministrar, abrir);
torneosRouter.post("/:id/inscripciones/cerrar", requireAuth, puedeAdministrar, cerrar);
torneosRouter.post("/:id/jugadores", requireAuth, puedeAdministrar, inscribir);
torneosRouter.get("/:id/jugadores", requireAuth, puedeAdministrar, listarJugadores);
