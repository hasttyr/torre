import { Router } from "express";

import { authRouter } from "./auth.routes";
import { jugadoresRouter } from "./jugadores.routes";
import { torneosRouter } from "./torneos.routes";
import { usersRouter } from "./users.routes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/torneos", torneosRouter);
router.use("/jugadores", jugadoresRouter);

// A medida que avancen los incrementos se montan aquí el resto de routers
// de dominio (emparejamiento, resultados, ...).
