import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma";
import { buscarJugadores } from "../services/jugadores.service";

export async function buscar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const jugadores = await buscarJugadores(prisma, query);
    res.status(200).json(jugadores);
  } catch (error) {
    next(error);
  }
}
