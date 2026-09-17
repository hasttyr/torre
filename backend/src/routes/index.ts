import { Router } from "express";

import { authRouter } from "./auth.routes";
import { usersRouter } from "./users.routes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/users", usersRouter);

// A medida que avancen los incrementos se montan aquí el resto de routers
// de dominio (torneos, emparejamiento, resultados, ...).
