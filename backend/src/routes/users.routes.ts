import { Router } from "express";

import { exerciseRight, me, myCoaches, updateProfile, updateRole } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, me);
usersRouter.put("/me", requireAuth, updateProfile);
usersRouter.get("/me/coaches", requireAuth, myCoaches);
usersRouter.post("/me/data-requests", requireAuth, exerciseRight);
usersRouter.patch("/:id/role", requireAuth, requireRole("ADMINISTRATOR"), updateRole);
