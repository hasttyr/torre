import { Router } from "express";

import {
  acceptMyCoach,
  exerciseRight,
  list,
  me,
  myNotifications,
  updateMyNotifications,
  myCoaches,
  removeMyCoach,
  updateProfile,
  updateRole,
  updateStatus,
} from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

export const usersRouter = Router();

const isAdmin = requireRole("ADMINISTRATOR");

// Before "/:id/...": otherwise Express would try to resolve "me" as an :id.
usersRouter.get("/me", requireAuth, me);
usersRouter.put("/me", requireAuth, updateProfile);
// #141: the email when a round of a tournament they play is published.
usersRouter.get("/me/notifications", requireAuth, myNotifications);
usersRouter.put("/me/notifications", requireAuth, updateMyNotifications);
usersRouter.get("/me/coaches", requireAuth, myCoaches);
usersRouter.post("/me/coaches/:coachId/accept", requireAuth, acceptMyCoach);
usersRouter.delete("/me/coaches/:coachId", requireAuth, removeMyCoach);
usersRouter.post("/me/data-requests", requireAuth, exerciseRight);
usersRouter.get("/", requireAuth, isAdmin, list);
usersRouter.patch("/:id/role", requireAuth, isAdmin, updateRole);
usersRouter.patch("/:id/status", requireAuth, isAdmin, updateStatus);
