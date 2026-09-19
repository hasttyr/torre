import { Router } from "express";

import { actualizarPerfil, me, updateRole } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, me);
usersRouter.put("/me", requireAuth, actualizarPerfil);
usersRouter.patch("/:id/rol", requireAuth, requireRole("ADMINISTRADOR"), updateRole);
