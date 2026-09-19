import { Router } from "express";

import { forgotPassword, login, logout, register, resetPassword } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/logout", requireAuth, logout);
authRouter.post("/password/forgot", forgotPassword);
authRouter.post("/password/reset", resetPassword);
