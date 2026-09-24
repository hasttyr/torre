import { Router } from "express";

import { getMine, getWidget, listLayouts, updateLayout } from "../controllers/dashboard.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const dashboardRouter = Router();

const isAdmin = requireRole("ADMINISTRATOR");

// Every authenticated role has a dashboard; which widgets it holds (and so
// which /widgets/:key it may read) is decided per role in the service.
dashboardRouter.get("/", requireAuth, getMine);
dashboardRouter.get("/widgets/:key", requireAuth, getWidget);
dashboardRouter.get("/layouts", requireAuth, isAdmin, listLayouts);
dashboardRouter.put("/layouts/:role", requireAuth, isAdmin, updateLayout);
