import { Router } from "express";

import { auditLogsRouter } from "./auditLogs.routes";
import { authRouter } from "./auth.routes";
import { clubsRouter } from "./clubs.routes";
import { coachesRouter } from "./coaches.routes";
import { dashboardRouter } from "./dashboard.routes";
import { playersRouter } from "./players.routes";
import { matchesRouter, roundsRouter } from "./rounds.routes";
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
router.use("/clubs", clubsRouter);
router.use("/coaches", coachesRouter);
router.use("/audit-logs", auditLogsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/rounds", roundsRouter);
router.use("/matches", matchesRouter);

// As future increments land, the rest of the domain routers (exports,
// ...) get mounted here.
