import { Router } from "express";

import { authRouter } from "./auth.routes";
import { playersRouter } from "./players.routes";
import { tournamentsRouter } from "./tournaments.routes";
import { usersRouter } from "./users.routes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/tournaments", tournamentsRouter);
router.use("/players", playersRouter);

// As future increments land, the rest of the domain routers (pairing,
// results, ...) get mounted here.
