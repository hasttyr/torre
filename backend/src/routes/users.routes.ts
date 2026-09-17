import { Router } from "express";

import { me, updateRole } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, me);
usersRouter.patch("/:id/rol", requireAuth, requireRole("ADMINISTRADOR"), updateRole);
