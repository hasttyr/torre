import { Router } from "express";

import { me, updateProfile, updateRole } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, me);
usersRouter.put("/me", requireAuth, updateProfile);
usersRouter.patch("/:id/role", requireAuth, requireRole("ADMINISTRADOR"), updateRole);
