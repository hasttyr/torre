import { Router } from "express";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// A medida que avancen los incrementos se montan aquí los routers de
// dominio, p. ej.: router.use("/auth", authRouter);
