import { Router } from "express";

import { exerciseRight, me, updateProfile, updateRole } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, me);
usersRouter.put("/me", requireAuth, updateProfile);
usersRouter.post("/me/data-requests", requireAuth, exerciseRight);
usersRouter.patch("/:id/role", requireAuth, requireRole("ADMINISTRADOR"), updateRole);
